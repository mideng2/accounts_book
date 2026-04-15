import Papa from 'papaparse';
import { db, type CategoryRecord, type ImportItemRecord, type ImportTaskRecord, type TransactionRecord } from '@/db/schema';

export interface AlipayPreviewItem {
  id: string;
  occurredAt: string;
  type: 'expense' | 'income';
  amount: number;
  merchant: string;
  description: string;
  sourceOrderId: string;
  categoryGuess: string;
  categoryId: string;
  skipReason?: string;
  willImport: boolean;
  ruleTags: Array<'no_count' | 'status' | 'non_consumption' | 'duplicate' | 'zero_amount' | 'refund_pair'>;
}

export interface AlipayPreviewResult {
  task: ImportTaskRecord;
  items: AlipayPreviewItem[];
  skippedCount: number;
  readyCount: number;
}

interface AlipayCsvRow {
  交易时间: string;
  交易分类: string;
  交易对方: string;
  对方账号: string;
  商品说明: string;
  '收/支': string;
  金额: string;
  '收/付款方式': string;
  交易状态: string;
  交易订单号: string;
  商家订单号: string;
  备注?: string;
}

const NON_CONSUMPTION_KEYWORDS = ['充值', '提现', '转账', '还款', '余额宝', '收益发放', '蚂蚁财富', '基金', '账户转存'];

export interface ImportFilterSettings {
  skipDuplicates: boolean;
  skipRefundPairs: boolean;
  skipZeroAmount: boolean;
  skipRepaymentAndTransfer: boolean;
  skipInvestmentFlow: boolean;
  skipNonSuccess: boolean;
  skipNoCount: boolean;
  skipPersonalTransfers: boolean;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeWhitespace(value: string | undefined) {
  return (value ?? '').replace(/\t/g, '').trim();
}

function normalizeMerchantKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function decodeAlipayText(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('gb18030').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function extractCsvDataSection(text: string) {
  const headerIndex = text.indexOf('交易时间,交易分类,交易对方');

  if (headerIndex < 0) {
    throw new Error('未找到支付宝账单明细表头，请确认文件格式是否正确。');
  }

  return text.slice(headerIndex).trim();
}

function getSkipTags(row: AlipayCsvRow) {
  const flowType = normalizeWhitespace(row['收/支']);
  const status = normalizeWhitespace(row['交易状态']);
  const description = `${normalizeWhitespace(row['商品说明'])} ${normalizeWhitespace(row['交易分类'])} ${normalizeWhitespace(row['交易对方'])}`;
  const tags: Array<'no_count' | 'status' | 'non_consumption'> = [];

  if (flowType === '不计收支') {
    tags.push('no_count');
  }

  if (status && status !== '交易成功') {
    tags.push('status');
  }

  if (NON_CONSUMPTION_KEYWORDS.some((keyword) => description.includes(keyword))) {
    tags.push('non_consumption');
  }

  return tags;
}

function guessCategory(categories: CategoryRecord[], row: AlipayCsvRow, type: 'expense' | 'income') {
  const byType = categories.filter((item) => item.type === type && item.enabled);
  const text = `${normalizeWhitespace(row['交易分类'])} ${normalizeWhitespace(row['商品说明'])} ${normalizeWhitespace(row['交易对方'])}`;

  const rules: Array<{ keyword: string; categoryName: string }> = [
    { keyword: '餐饮', categoryName: '餐饮' },
    { keyword: '外卖', categoryName: '餐饮' },
    { keyword: '咖啡', categoryName: '餐饮' },
    { keyword: '地铁', categoryName: '交通' },
    { keyword: '公交', categoryName: '交通' },
    { keyword: '交通', categoryName: '交通' },
    { keyword: '日用', categoryName: '日用' },
    { keyword: '超市', categoryName: '日用' },
    { keyword: '蔬菜', categoryName: '买菜' },
    { keyword: '水果', categoryName: '买菜' },
    { keyword: '医疗', categoryName: '医疗' },
    { keyword: '保险', categoryName: '保险' },
    { keyword: '还款', categoryName: '信用卡还款' },
    { keyword: '信用卡', categoryName: '信用卡还款' },
    { keyword: '公积金', categoryName: '公积金' },
    { keyword: '住宿', categoryName: '旅游' },
    { keyword: '酒店', categoryName: '旅游' },
    { keyword: '购物', categoryName: '购物' },
    { keyword: '百货', categoryName: '购物' },
    { keyword: '工资', categoryName: '工资' },
    { keyword: '退款', categoryName: '退款' }
  ];

  const matchedRule = rules.find((rule) => text.includes(rule.keyword));
  const matchedCategory = matchedRule
    ? byType.find((item) => item.name === matchedRule.categoryName)
    : byType.find((item) => text.includes(item.name));

  return matchedCategory ?? byType[0] ?? null;
}

async function buildDedupeMaps() {
  const existingTransactions = await db.transactions.toArray();
  const sourceIds = new Set(existingTransactions.map((item) => `${item.source}:${item.sourceId ?? ''}`));
  const fallbackKeys = new Set(
    existingTransactions.map((item) => `${item.occurredAt.slice(0, 16)}|${item.amount}|${item.merchant ?? ''}`)
  );

  return { sourceIds, fallbackKeys };
}

function markRefundPairs(items: AlipayPreviewItem[]) {
  const expenseBuckets = new Map<string, AlipayPreviewItem[]>();
  const incomeBuckets = new Map<string, AlipayPreviewItem[]>();

  for (const item of items) {
    const key = `${normalizeMerchantKey(item.merchant)}|${item.amount}`;
    const target = item.type === 'expense' ? expenseBuckets : incomeBuckets;
    const bucket = target.get(key) ?? [];
    bucket.push(item);
    target.set(key, bucket);
  }

  for (const [key, expenseItems] of expenseBuckets.entries()) {
    const incomeItems = incomeBuckets.get(key);

    if (!incomeItems?.length) {
      continue;
    }

    const pairCount = Math.min(expenseItems.length, incomeItems.length);

    for (let index = 0; index < pairCount; index += 1) {
      const expenseItem = expenseItems[index];
      const incomeItem = incomeItems[index];

      if (!expenseItem.ruleTags.includes('refund_pair')) {
        expenseItem.ruleTags.push('refund_pair');
      }
      if (!incomeItem.ruleTags.includes('refund_pair')) {
        incomeItem.ruleTags.push('refund_pair');
      }
    }
  }
}

export async function parseAlipayCsvFile(file: File, categories: CategoryRecord[]): Promise<AlipayPreviewResult> {
  const buffer = await file.arrayBuffer();
  const text = decodeAlipayText(buffer);
  const csvSection = extractCsvDataSection(text);
  const parsed = Papa.parse<AlipayCsvRow>(csvSection, {
    header: true,
    skipEmptyLines: true
  });

  const { sourceIds, fallbackKeys } = await buildDedupeMaps();
  const taskId = createId('import-task');
  const createdAt = new Date().toISOString();
  const items: AlipayPreviewItem[] = [];
  const importItemRecords: ImportItemRecord[] = [];
  let skippedCount = 0;
  let readyCount = 0;

  for (const row of parsed.data) {
    const occurredAtText = normalizeWhitespace(row['交易时间']);
    const amountText = normalizeWhitespace(row['金额']);
    const flowType = normalizeWhitespace(row['收/支']);
    const sourceOrderId = normalizeWhitespace(row['交易订单号']) || normalizeWhitespace(row['商家订单号']);

    if (!occurredAtText || !amountText || !flowType) {
      continue;
    }

    const type = flowType === '收入' ? 'income' : 'expense';
    const skipTags = getSkipTags(row);
    const occurredAt = new Date(occurredAtText.replace(' ', 'T')).toISOString();
    const amount = Math.round(Number(amountText) * 100);
    const merchant = normalizeWhitespace(row['交易对方']) || normalizeWhitespace(row['商品说明']) || '支付宝交易';
    const description = normalizeWhitespace(row['商品说明']) || normalizeWhitespace(row['交易分类']);
    const category = guessCategory(categories, row, type);
    const fallbackKey = `${occurredAt.slice(0, 16)}|${amount}|${merchant}`;
    const duplicate =
      sourceIds.has(`alipay_import:${sourceOrderId}`) ||
      (sourceOrderId === '' && fallbackKeys.has(fallbackKey)) ||
      fallbackKeys.has(fallbackKey);

    const ruleTags: AlipayPreviewItem['ruleTags'] = [...skipTags];
    if (amount === 0) {
      ruleTags.push('zero_amount');
    }
    if (duplicate) {
      ruleTags.push('duplicate');
    }
    const finalSkipReason = ruleTags.length ? '待按导入过滤规则决定' : '';
    const willImport = true;

    if (willImport) {
      readyCount += 1;
    } else {
      skippedCount += 1;
    }

    const previewItem: AlipayPreviewItem = {
      id: createId('preview-item'),
      occurredAt,
      type,
      amount,
      merchant,
      description,
      sourceOrderId,
      categoryGuess: category?.name ?? '未分类',
      categoryId: category?.id ?? '',
      skipReason: finalSkipReason || undefined,
      willImport,
      ruleTags
    };

    items.push(previewItem);
    importItemRecords.push({
      id: previewItem.id,
      taskId,
      channel: 'alipay',
      rawText: JSON.stringify(row),
      occurredAt,
      amount,
      direction: type,
      merchant,
      description,
      sourceOrderId,
      dedupeKey: sourceOrderId || fallbackKey,
      status: 'pending',
      skipReason: finalSkipReason || undefined
    });
  }

  markRefundPairs(items);

  const task: ImportTaskRecord = {
    id: taskId,
    channel: 'alipay',
    fileName: file.name,
    status: 'parsed',
    totalCount: items.length,
    importedCount: 0,
    skippedCount,
    createdAt
  };

  await db.transaction('rw', [db.importTasks, db.importItems], async () => {
    await db.importTasks.add(task);
    if (importItemRecords.length) {
      await db.importItems.bulkAdd(importItemRecords);
    }
  });

  return {
    task,
    items,
    skippedCount,
    readyCount
  };
}

export async function confirmAlipayImport(
  taskId: string,
  items: AlipayPreviewItem[],
  accountId: string
) {
  const importableItems = items.filter((item) => item.willImport && item.categoryId);
  const createdAt = new Date().toISOString();

  const transactions: TransactionRecord[] = importableItems.map((item) => ({
    id: createId('tx'),
    type: item.type,
    amount: item.amount,
    accountId,
    categoryId: item.categoryId,
    occurredAt: item.occurredAt,
    merchant: item.merchant,
    note: item.description,
    source: 'alipay_import',
    sourceId: item.sourceOrderId || item.id,
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
      skippedCount: items.filter((item) => !item.willImport || !item.categoryId).length
    });

    for (const item of items) {
      await db.importItems.update(item.id, { status: 'imported' });
    }
    for (const item of items.filter((entry) => !entry.willImport || !entry.categoryId)) {
      await db.importItems.update(item.id, { status: 'skipped', skipReason: item.skipReason });
    }
  });

  return transactions.length;
}
