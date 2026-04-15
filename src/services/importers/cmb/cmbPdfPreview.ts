import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db, type CategoryRecord, type ImportItemRecord, type ImportTaskRecord, type TransactionRecord } from '@/db/schema';

GlobalWorkerOptions.workerSrc = workerSrc;

export interface CmbPdfPreviewPage {
  id: string;
  pageNumber: number;
  text: string;
  previewText: string;
}

export interface CmbParsedEntry {
  id: string;
  occurredAt: string;
  currency: string;
  amount: number;
  balance: number;
  summary: string;
  counterparty: string;
  type: 'expense' | 'income';
  categoryGuess: string;
  categoryId: string;
  willImport: boolean;
  skipReason?: string;
  ruleTags: Array<'duplicate' | 'repayment' | 'investment' | 'transfer' | 'personal_transfer' | 'zero_amount' | 'refund_pair'>;
}

export interface CmbPdfPreviewResult {
  task: ImportTaskRecord;
  pages: CmbPdfPreviewPage[];
  entries: CmbParsedEntry[];
  fullText: string;
}

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
}

interface ParsedRow {
  date: string;
  currency: string;
  amount: string;
  balance: string;
  summary: string;
  counterparty: string;
}

const ROW_TOLERANCE = 2.5;
const CMB_DIRECT_SKIP_KEYWORDS = [
  '信用卡预约还款',
  '微信转账',
  '黄金账户',
  '朝朝宝转出',
  '群收款',
  '银联代付',
  '小金库',
  '肯特瑞',
  '理财',
  '基金',
  '申购',
  '赎回',
  '还款',
  '结息',
  '清算专户'
];
const QUICK_PAY_SUMMARIES = new Set(['快捷支付', '银联快捷支付', '银联线上有卡支付']);
const HEADER_NOISE_PATTERNS = [
  /\d+\/\d+交易摘要[\s\S]*?Counter PartyAmount/g,
  /交易摘要[\s\S]*?Counter PartyAmount/g,
  /TransactionTransaction Type Counter PartyAmount/g,
  /Transaction\s*Transaction Type\s*Counter Party\s*Amount/g,
  /Transaction\s*Counter Party\s*Amount/g,
  /交易时间[\s\S]*?交易摘要/g,
  /Transaction Type/g,
  /Counter PartyAmount/g,
  /Counter Party Amount/g,
  /对手信息/g,
  /应付利息-应付个人活期存款利.*$/g,
  /待清算电子汇差-代销理财快赎.*$/g,
  /息\(自动计提\).*$/g
];
const CONSUMPTION_COUNTERPARTY_KEYWORDS = [
  '店',
  '餐',
  '饭',
  '饺',
  '云饺',
  '馆',
  '酒店',
  '咖啡',
  '医院',
  '出行',
  '旅行',
  '商城',
  '平台',
  '有限公司',
  '公司',
  '超市',
  '月付',
  '抖音',
  '客运',
  '奶制品',
  '舞蹈',
  '快餐',
  '抓饭',
  '医院',
  '景区',
  '景点',
  '住宿',
  '民宿',
  'Coffee',
  'coffee',
  'Manner',
  '京东',
  '携程',
  '滴滴',
  '一卡通'
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toPreviewText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizeWhitespace(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCounterpartyKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function stripHeaderNoise(value: string) {
  return normalizeWhitespace(
    HEADER_NOISE_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), value)
      .replace(/^\d+\/\d+/, '')
      .replace(/^第?\d+页/, '')
  );
}

function groupRows(items: PdfTextItem[]) {
  const normalized = items
    .map((item) => ({
      text: normalizeWhitespace(item.str),
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0)
    }))
    .filter((item) => item.text);

  normalized.sort((a, b) => (Math.abs(b.y - a.y) > ROW_TOLERANCE ? b.y - a.y : a.x - b.x));

  const rows: Array<{ y: number; columns: typeof normalized }> = [];

  for (const item of normalized) {
    const existing = rows.find((row) => Math.abs(row.y - item.y) <= ROW_TOLERANCE);

    if (existing) {
      existing.columns.push(item);
    } else {
      rows.push({ y: item.y, columns: [item] });
    }
  }

  rows.sort((a, b) => b.y - a.y);
  rows.forEach((row) => row.columns.sort((a, b) => a.x - b.x));

  return rows;
}

function rowToText(row: { columns: Array<{ text: string }> }) {
  return row.columns.map((item) => item.text).join(' ').trim();
}

function isDividerRowText(value: string) {
  const compact = value.replace(/\s+/g, '');
  return compact.length >= 8 && /^[-—_=]+$/.test(compact);
}

function isCounterpartyContinuationRow(
  row: { columns: Array<{ text: string; x: number }> },
  structured: ParsedRow
) {
  const hasLeadingColumns = row.columns.some((item) => item.x < 305);
  return (
    !structured.date &&
    !structured.currency &&
    !structured.amount &&
    !structured.balance &&
    !hasLeadingColumns &&
    Boolean(structured.summary || structured.counterparty)
  );
}

function columnsToStructuredRow(row: { columns: Array<{ text: string; x: number }> }): ParsedRow {
  const result: ParsedRow = {
    date: '',
    currency: '',
    amount: '',
    balance: '',
    summary: '',
    counterparty: ''
  };

  for (const item of row.columns) {
    if (item.x < 90) {
      result.date += item.text;
    } else if (item.x < 150) {
      result.currency += item.text;
    } else if (item.x < 230) {
      result.amount += item.text;
    } else if (item.x < 305) {
      result.balance += item.text;
    } else if (item.x < 417) {
      result.summary += item.text;
    } else {
      result.counterparty += item.text;
    }
  }

  result.date = normalizeWhitespace(result.date);
  result.currency = normalizeWhitespace(result.currency);
  result.amount = normalizeWhitespace(result.amount);
  result.balance = normalizeWhitespace(result.balance);
  result.summary = normalizeWhitespace(result.summary);
  result.counterparty = normalizeWhitespace(result.counterparty);

  return result;
}

function parseCurrencyAmount(value: string) {
  return Math.round(Number(value.replace(/,/g, '')) * 100);
}

function isPersonalNameLike(value: string) {
  const cleaned = value.replace(/[（）()·.\-·\s]/g, '');

  if (!cleaned || /\d/.test(cleaned)) {
    return false;
  }

  if (CONSUMPTION_COUNTERPARTY_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return false;
  }

  return /^[\u4e00-\u9fa5]{2,12}$/.test(cleaned);
}

function getSkipRule(entry: ParsedRow, type: 'expense' | 'income') {
  const summary = stripHeaderNoise(entry.summary);
  const counterparty = stripHeaderNoise(entry.counterparty);
  const text = `${summary} ${counterparty}`;
  const directKeyword = CMB_DIRECT_SKIP_KEYWORDS.find((keyword) => text.includes(keyword));

  if (directKeyword) {
    if (/还款/.test(directKeyword)) {
      return { tag: 'repayment' as const, reason: `识别为${directKeyword}` };
    }

    if (/理财|基金|黄金账户|申购|赎回|朝朝宝|小金库|肯特瑞|清算/.test(directKeyword)) {
      return { tag: 'investment' as const, reason: `识别为${directKeyword}` };
    }

    return { tag: 'transfer' as const, reason: `识别为${directKeyword}` };
  }

  if (type === 'income' && /(朝朝宝|理财|代付|结息|利息|赎回)/.test(text)) {
    return { tag: 'investment' as const, reason: '识别为资金回流或理财收益' };
  }

  if (type === 'expense' && QUICK_PAY_SUMMARIES.has(summary) && isPersonalNameLike(counterparty)) {
    return { tag: 'personal_transfer' as const, reason: '疑似个人转账' };
  }

  if (type === 'expense' && counterparty === '微信转账') {
    return { tag: 'transfer' as const, reason: '识别为微信转账' };
  }

  return null;
}

function guessCategory(categories: CategoryRecord[], summary: string, counterparty: string, type: 'expense' | 'income') {
  const byType = categories.filter((item) => item.type === type && item.enabled);
  const text = `${summary} ${counterparty}`;
  const rules: Array<{ keyword: string; categoryName: string }> = [
    { keyword: '公积金', categoryName: '公积金' },
    { keyword: '保险', categoryName: '保险' },
    { keyword: '还款', categoryName: '信用卡还款' },
    { keyword: '信用卡', categoryName: '信用卡还款' },
    { keyword: '餐', categoryName: '餐饮' },
    { keyword: '饭', categoryName: '餐饮' },
    { keyword: '饺', categoryName: '餐饮' },
    { keyword: '咖啡', categoryName: '餐饮' },
    { keyword: '地铁', categoryName: '交通' },
    { keyword: '一卡通', categoryName: '交通' },
    { keyword: '滴滴', categoryName: '交通' },
    { keyword: '酒店', categoryName: '旅游' },
    { keyword: '携程', categoryName: '旅游' },
    { keyword: '医疗', categoryName: '医疗' },
    { keyword: '退款', categoryName: '退款' }
  ];

  const matchedRule = rules.find((rule) => text.includes(rule.keyword));
  const matchedCategory = matchedRule
    ? byType.find((item) => item.name === matchedRule.categoryName)
    : byType.find((item) => text.includes(item.name));

  return matchedCategory ?? byType[0] ?? null;
}

function buildStructuredEntries(
  rows: Array<{ columns: Array<{ text: string; x: number }> }>,
  categories: CategoryRecord[]
) {
  const entries: CmbParsedEntry[] = [];
  let currentEntry: CmbParsedEntry | null = null;
  let pendingCounterpartyText = '';

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rawRowText = rowToText(row);

    if (isDividerRowText(rawRowText)) {
      break;
    }

    const structured = columnsToStructuredRow(row);
    const isDataRow = /^\d{4}-\d{2}-\d{2}$/.test(structured.date) && /^-?[\d,]+\.\d{2}$/.test(structured.amount);
    const isContinuationRow = isCounterpartyContinuationRow(row, structured);

    if (isContinuationRow) {
      const continuation = stripHeaderNoise(
        normalizeWhitespace(`${structured.summary} ${structured.counterparty}`.trim() || rawRowText),
      );
      const nextStructured = rows[index + 1] ? columnsToStructuredRow(rows[index + 1]) : null;
      const nextIsDataRow = nextStructured
        ? /^\d{4}-\d{2}-\d{2}$/.test(nextStructured.date) && /^-?[\d,]+\.\d{2}$/.test(nextStructured.amount)
        : false;
      const nextCounterparty = stripHeaderNoise(nextStructured?.counterparty ?? '');
      const shouldAttachToNext =
        nextIsDataRow &&
        !nextCounterparty &&
        Boolean(currentEntry?.counterparty);

      if (!continuation) {
        continue;
      }

      if (shouldAttachToNext) {
        pendingCounterpartyText = normalizeWhitespace(
          `${pendingCounterpartyText} ${continuation}`,
        );
      } else if (currentEntry && currentEntry.summary) {
        const mergedCounterparty = normalizeWhitespace(
          `${currentEntry.counterparty} ${continuation}`,
        );
        currentEntry.counterparty = mergedCounterparty;

        const updatedSkipRule = getSkipRule(
          {
            date: currentEntry.occurredAt.slice(0, 10),
            currency: currentEntry.currency,
            amount: String(currentEntry.amount / 100),
            balance: String(currentEntry.balance / 100),
            summary: currentEntry.summary,
            counterparty: mergedCounterparty,
          },
          currentEntry.type,
        );

        if (updatedSkipRule) {
          currentEntry.skipReason = updatedSkipRule.reason;
          if (!currentEntry.ruleTags.includes(updatedSkipRule.tag)) {
            currentEntry.ruleTags.push(updatedSkipRule.tag);
          }
        }
      } else {
        pendingCounterpartyText = normalizeWhitespace(
          `${pendingCounterpartyText} ${continuation}`,
        );
      }

      continue;
    }

    if (isDataRow) {
      const amount = parseCurrencyAmount(structured.amount);
      const balance = structured.balance ? parseCurrencyAmount(structured.balance) : 0;
      const type = amount >= 0 ? 'income' : 'expense';
      const summary = stripHeaderNoise(structured.summary);
      const counterparty = stripHeaderNoise(
        normalizeWhitespace(`${pendingCounterpartyText} ${structured.counterparty}`),
      );
      const category = guessCategory(categories, structured.summary, counterparty, type);
      const skipRule = getSkipRule({ ...structured, summary, counterparty }, type);
      const entry: CmbParsedEntry = {
        id: createId('cmb-entry'),
        occurredAt: new Date(`${structured.date}T12:00:00`).toISOString(),
        currency: structured.currency || 'CNY',
        amount: Math.abs(amount),
        balance,
        summary,
        counterparty,
        type,
        categoryGuess: category?.name ?? '未分类',
        categoryId: category?.id ?? '',
        willImport: true,
        skipReason: skipRule?.reason || undefined,
        ruleTags: skipRule ? [skipRule.tag] : []
      };

      if (entry.amount === 0) {
        entry.ruleTags.push('zero_amount');
      }

      entries.push(entry);
      currentEntry = entry;
      pendingCounterpartyText = '';
      continue;
    }

    if (!currentEntry) {
      continue;
    }

    const continuationText = stripHeaderNoise(
      normalizeWhitespace(
        `${structured.summary} ${structured.counterparty}`.trim() || rawRowText,
      ),
    );

    if (!continuationText) {
      continue;
    }

    const mergedCounterparty = normalizeWhitespace(`${currentEntry.counterparty} ${continuationText}`);
    currentEntry.counterparty = mergedCounterparty;
    if (currentEntry.willImport) {
      const updatedSkipRule = getSkipRule(
        {
          date: currentEntry.occurredAt.slice(0, 10),
          currency: currentEntry.currency,
          amount: String(currentEntry.amount / 100),
          balance: String(currentEntry.balance / 100),
          summary: currentEntry.summary,
          counterparty: mergedCounterparty
        },
        currentEntry.type
      );
      if (updatedSkipRule) {
        currentEntry.skipReason = updatedSkipRule.reason;
        if (!currentEntry.ruleTags.includes(updatedSkipRule.tag)) {
          currentEntry.ruleTags.push(updatedSkipRule.tag);
        }
      }
    }
  }

  return entries;
}

async function buildDedupeMaps() {
  const existingTransactions = await db.transactions.toArray();
  const sourceIds = new Set(existingTransactions.map((item) => `${item.source}:${item.sourceId ?? ''}`));
  const fallbackKeys = new Set(
    existingTransactions.map((item) => `${item.occurredAt.slice(0, 10)}|${item.amount}|${item.merchant ?? ''}`)
  );

  return { sourceIds, fallbackKeys };
}

function markRefundPairs(entries: CmbParsedEntry[]) {
  const expenseBuckets = new Map<string, CmbParsedEntry[]>();
  const incomeBuckets = new Map<string, CmbParsedEntry[]>();

  for (const entry of entries) {
    const key = `${normalizeCounterpartyKey(entry.counterparty)}|${entry.amount}`;
    const target = entry.type === 'expense' ? expenseBuckets : incomeBuckets;
    const bucket = target.get(key) ?? [];
    bucket.push(entry);
    target.set(key, bucket);
  }

  for (const [key, expenseEntries] of expenseBuckets.entries()) {
    const incomeEntries = incomeBuckets.get(key);

    if (!incomeEntries?.length) {
      continue;
    }

    const pairCount = Math.min(expenseEntries.length, incomeEntries.length);

    for (let index = 0; index < pairCount; index += 1) {
      const expenseEntry = expenseEntries[index];
      const incomeEntry = incomeEntries[index];

      if (!expenseEntry.ruleTags.includes('refund_pair')) {
        expenseEntry.ruleTags.push('refund_pair');
      }
      if (!incomeEntry.ruleTags.includes('refund_pair')) {
        incomeEntry.ruleTags.push('refund_pair');
      }
    }
  }
}

export async function extractCmbPdfPreview(file: File, categories: CategoryRecord[]): Promise<CmbPdfPreviewResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  const taskId = createId('import-task');
  const createdAt = new Date().toISOString();
  const pages: CmbPdfPreviewPage[] = [];
  const structuredRows: Array<{ columns: Array<{ text: string; x: number }> }> = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as PdfTextItem[];
    const rows = groupRows(items);
    const pageText = rows.map((row) => rowToText(row)).join('\n');

    pages.push({
      id: createId('cmb-page'),
      pageNumber,
      text: pageText,
      previewText: toPreviewText(pageText)
    });

    structuredRows.push(...rows);
  }

  const entries = buildStructuredEntries(structuredRows, categories);
  markRefundPairs(entries);
  const { sourceIds, fallbackKeys } = await buildDedupeMaps();

  for (const entry of entries) {
    const sourceId = `${entry.occurredAt.slice(0, 10)}|${entry.amount}|${entry.summary}|${entry.counterparty}`;
    const fallbackKey = `${entry.occurredAt.slice(0, 10)}|${entry.amount}|${entry.counterparty}`;

    if (sourceIds.has(`cmb_import:${sourceId}`) || fallbackKeys.has(fallbackKey)) {
      if (!entry.ruleTags.includes('duplicate')) {
        entry.ruleTags.push('duplicate');
      }
      entry.skipReason = '检测到重复账目';
    }
  }

  const importItems: ImportItemRecord[] = entries.map((entry) => ({
    id: entry.id,
    taskId,
    channel: 'cmb',
    rawText: JSON.stringify(entry),
    occurredAt: entry.occurredAt,
    amount: entry.amount,
    direction: entry.type,
    merchant: entry.counterparty,
    description: entry.summary,
    dedupeKey: `${entry.occurredAt.slice(0, 10)}|${entry.amount}|${entry.summary}|${entry.counterparty}`,
    status: 'pending',
    skipReason: entry.skipReason
  }));

  const task: ImportTaskRecord = {
    id: taskId,
    channel: 'cmb',
    fileName: file.name,
    status: 'parsed',
    totalCount: entries.length,
    importedCount: 0,
    skippedCount: 0,
    createdAt
  };

  await db.transaction('rw', [db.importTasks, db.importItems], async () => {
    await db.importTasks.add(task);
    if (importItems.length) {
      await db.importItems.bulkAdd(importItems);
    }
  });

  return {
    task,
    pages,
    entries,
    fullText: pages.map((item) => `--- 第 ${item.pageNumber} 页 ---\n${item.text}`).join('\n\n')
  };
}

export async function confirmCmbImport(taskId: string, entries: CmbParsedEntry[], accountId: string) {
  const importableEntries = entries.filter((item) => item.willImport && item.categoryId);
  const createdAt = new Date().toISOString();

  const transactions: TransactionRecord[] = importableEntries.map((item) => ({
    id: createId('tx'),
    type: item.type,
    amount: item.amount,
    accountId,
    categoryId: item.categoryId,
    occurredAt: item.occurredAt,
    merchant: item.counterparty || item.summary,
    note: item.summary,
    source: 'cmb_import',
    sourceId: `${item.occurredAt.slice(0, 10)}|${item.amount}|${item.summary}|${item.counterparty}`,
    createdAt,
    updatedAt: createdAt
  }));

  await db.transaction('rw', [db.transactions, db.importTasks, db.importItems], async () => {
    if (transactions.length) {
      await db.transactions.bulkAdd(transactions);
    }

    await db.importTasks.update(taskId, {
      status: 'confirmed',
      importedCount: transactions.length,
      skippedCount: entries.filter((item) => !item.willImport || !item.categoryId).length
    });

    for (const entry of entries) {
      await db.importItems.update(entry.id, {
        status: entry.willImport && entry.categoryId ? 'imported' : 'skipped',
        skipReason: entry.willImport ? undefined : entry.skipReason
      });
    }
  });

  return transactions.length;
}
