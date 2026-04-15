<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">账单导入</p>
        <h1>导入</h1>
        <p class="page__desc">导入是加速工具，不是黑盒。先把原始候选都展示出来，再由你决定过滤到什么程度。</p>
      </div>
    </header>

    <SectionCard title="新建导入" caption="支付宝 CSV 和 招商 PDF 都会先进入预览区">
      <div class="import-grid">
        <label class="import-box import-box--button">
          <strong>支付宝</strong>
          <span>{{ selectedFileName || '选择 CSV 文件' }}</span>
          <input type="file" accept=".csv,text/csv" @change="handleFileSelect" />
        </label>
        <label class="import-box import-box--button">
          <strong>招商银行</strong>
          <span>{{ pdfFileName || '选择 PDF 文件' }}</span>
          <input type="file" accept=".pdf,application/pdf" @change="handlePdfSelect" />
        </label>
        <div class="import-box import-box--muted">
          <strong>策略</strong>
          <span>先全量预览，再按规则过滤或逐条勾选</span>
        </div>
      </div>
      <div class="action-row" style="margin-top: 12px;">
        <button class="action-button" :disabled="parsing || !selectedFile" @click="parseSelectedFile">
          {{ parsing ? '解析中...' : '解析支付宝 CSV' }}
        </button>
        <button class="action-button action-button--ghost" :disabled="pdfParsing || !pdfFile" @click="parsePdfPreview">
          {{ pdfParsing ? '抽取中...' : '抽取招商 PDF 文本' }}
        </button>
      </div>
      <p v-if="message" class="form-message">{{ message }}</p>
    </SectionCard>

    <SectionCard v-if="preview" title="支付宝预览" :caption="`${preview.task.fileName} · 原始候选全展示`">
      <div class="summary-grid">
        <div class="summary-tile">
          <span>解析条数</span>
          <strong>{{ preview.items.length }}</strong>
        </div>
        <div class="summary-tile">
          <span>待导入</span>
          <strong>{{ alipayReadyCount }}</strong>
        </div>
        <div class="summary-tile">
          <span>跳过</span>
          <strong>{{ alipaySkippedCount }}</strong>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 12px;">
        <label class="field field--full">
          <span>导入到账户</span>
          <select v-model="selectedAccountId">
            <option v-for="item in financeStore.assetAccounts" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div class="filter-panel">
        <div class="filter-panel__title">过滤设置</div>
        <label class="filter-chip"><input v-model="alipayFilters.skipDuplicates" type="checkbox" @change="applyAlipayFilters" />跳过重复记录</label>
        <label class="filter-chip"><input v-model="alipayFilters.skipRefundPairs" type="checkbox" @change="applyAlipayFilters" />跳过退款配对</label>
        <label class="filter-chip"><input v-model="alipayFilters.skipZeroAmount" type="checkbox" @change="applyAlipayFilters" />跳过金额为 0</label>
        <label class="filter-chip"><input v-model="alipayFilters.skipNoCount" type="checkbox" @change="applyAlipayFilters" />跳过不计收支</label>
        <label class="filter-chip"><input v-model="alipayFilters.skipNonSuccess" type="checkbox" @change="applyAlipayFilters" />跳过非成功状态</label>
        <label class="filter-chip">
          <input v-model="alipayFilters.skipRepaymentAndTransfer" type="checkbox" @change="applyAlipayFilters" />
          跳过还款/转账/充值
        </label>
      </div>

      <div class="preview-toolbar">
        <span>当前展示 {{ preview.items.length }} 条原始候选</span>
        <button class="text-button" @click="setAllAlipayImport(true)">全部纳入</button>
        <button class="text-button" @click="setAllAlipayImport(false)">全部跳过</button>
      </div>

      <div class="preview-list">
        <article
          v-for="item in preview.items"
          :key="item.id"
          class="preview-item"
          :class="{ 'preview-item--skipped': !item.willImport }"
        >
          <div class="preview-item__head">
            <strong>{{ item.merchant }}</strong>
            <span>{{ item.type === 'income' ? '+' : '-' }}{{ formatAmountFromCent(item.amount) }}</span>
          </div>
          <p>{{ item.description || item.categoryGuess }}</p>
          <div class="preview-item__meta">
            <span>{{ formatDateLabel(item.occurredAt) }}</span>
            <span>{{ item.categoryGuess }}</span>
            <span v-if="item.skipReason">{{ item.skipReason }}</span>
          </div>
          <div class="preview-item__actions">
            <button class="text-button" @click="toggleAlipayItem(item)">
              {{ item.willImport ? '改为跳过' : '纳入导入' }}
            </button>
          </div>
        </article>
      </div>

      <div class="action-row" style="margin-top: 12px;">
        <button class="action-button action-button--ghost" @click="clearPreview">清空预览</button>
        <button class="action-button" :disabled="confirming || !selectedAccountId" @click="confirmImport">
          {{ confirming ? '导入中...' : '确认导入支付宝账单' }}
        </button>
      </div>
    </SectionCard>

    <SectionCard v-if="pdfPreview" title="招商 PDF 预览" :caption="`${pdfPreview.task.fileName} · 原始候选全展示`">
      <div class="summary-grid">
        <div class="summary-tile">
          <span>解析条数</span>
          <strong>{{ pdfPreview.entries.length }}</strong>
        </div>
        <div class="summary-tile">
          <span>待导入</span>
          <strong>{{ pdfReadyCount }}</strong>
        </div>
        <div class="summary-tile">
          <span>跳过</span>
          <strong>{{ pdfSkippedCount }}</strong>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 12px;">
        <label class="field field--full">
          <span>导入到账户</span>
          <select v-model="selectedCmbAccountId">
            <option v-for="item in financeStore.assetAccounts" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div class="filter-panel">
        <div class="filter-panel__title">过滤设置</div>
        <label class="filter-chip"><input v-model="cmbFilters.skipDuplicates" type="checkbox" @change="applyCmbFilters" />跳过重复记录</label>
        <label class="filter-chip"><input v-model="cmbFilters.skipRefundPairs" type="checkbox" @change="applyCmbFilters" />跳过退款配对</label>
        <label class="filter-chip"><input v-model="cmbFilters.skipZeroAmount" type="checkbox" @change="applyCmbFilters" />跳过金额为 0</label>
        <label class="filter-chip"><input v-model="cmbFilters.skipRepaymentAndTransfer" type="checkbox" @change="applyCmbFilters" />跳过还款/转账</label>
        <label class="filter-chip"><input v-model="cmbFilters.skipInvestmentFlow" type="checkbox" @change="applyCmbFilters" />跳过理财/资金调拨</label>
        <label class="filter-chip"><input v-model="cmbFilters.skipPersonalTransfers" type="checkbox" @change="applyCmbFilters" />跳过疑似个人转账</label>
      </div>

      <div class="preview-toolbar">
        <span>当前展示 {{ pdfPreview.entries.length }} 条原始候选</span>
        <button class="text-button" @click="setAllCmbImport(true)">全部纳入</button>
        <button class="text-button" @click="setAllCmbImport(false)">全部跳过</button>
      </div>

      <div class="preview-list" style="margin-top: 14px;">
        <article
          v-for="entry in pdfPreview.entries"
          :key="entry.id"
          class="preview-item"
          :class="{ 'preview-item--skipped': !entry.willImport }"
        >
          <div class="preview-item__head">
            <strong>{{ entry.counterparty || '未识别对手方' }}</strong>
            <span>{{ entry.type === 'income' ? '+' : '-' }}{{ formatAmountFromCent(entry.amount) }}</span>
          </div>
          <p>{{ entry.summary || '未识别摘要' }}</p>
          <div class="preview-item__meta">
            <span>{{ formatDateLabel(entry.occurredAt) }}</span>
            <span>{{ entry.currency }}</span>
            <span>{{ entry.categoryGuess }}</span>
            <span>余额 {{ formatAmountFromCent(entry.balance) }}</span>
            <span v-if="entry.skipReason">{{ entry.skipReason }}</span>
          </div>
          <div class="preview-item__actions">
            <button class="text-button" @click="toggleCmbItem(entry)">
              {{ entry.willImport ? '改为跳过' : '纳入导入' }}
            </button>
          </div>
        </article>
      </div>

      <SectionCard title="分页文本预览" caption="用于核对当前固定模板的抽取质量" style="margin-top: 14px;">
        <div class="preview-list">
          <article v-for="page in pdfPreview.pages.slice(0, 3)" :key="page.id" class="preview-item">
            <div class="preview-item__head">
              <strong>第 {{ page.pageNumber }} 页</strong>
              <span>文本预览</span>
            </div>
            <p>{{ page.previewText || '本页未抽取到明显文本。' }}</p>
          </article>
        </div>
      </SectionCard>

      <label class="field field--full" style="margin-top: 14px;">
        <span>抽取全文</span>
        <textarea :value="pdfPreview.fullText" rows="12" readonly></textarea>
      </label>

      <div class="action-row" style="margin-top: 12px;">
        <button class="action-button action-button--ghost" @click="clearPdfPreview">清空 PDF 预览</button>
        <button class="action-button" :disabled="cmbConfirming || !selectedCmbAccountId" @click="confirmCmbPdfImport">
          {{ cmbConfirming ? '导入中...' : '确认导入招商账单' }}
        </button>
      </div>
    </SectionCard>

    <SectionCard title="导入历史" caption="最近导入任务">
      <div class="import-history">
        <article v-for="task in importHistory" :key="task.id" class="import-history__item">
          <h3>{{ task.fileName }}</h3>
          <p>
            {{ task.channel === 'alipay' ? '支付宝' : '招商银行' }} · {{ task.status }} · 解析 {{ task.totalCount }} 条 ·
            已导入 {{ task.importedCount }} 条 · 跳过 {{ task.skippedCount }} 条
          </p>
        </article>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import SectionCard from '@/components/base/SectionCard.vue';
import { useFinanceStore } from '@/app/store/finance';
import { db, type ImportTaskRecord } from '@/db/schema';
import {
  confirmAlipayImport,
  parseAlipayCsvFile,
  type AlipayPreviewItem,
  type AlipayPreviewResult,
  type ImportFilterSettings
} from '@/services/importers/alipay/alipayImporter';
import {
  confirmCmbImport,
  extractCmbPdfPreview,
  type CmbParsedEntry,
  type CmbPdfPreviewResult
} from '@/services/importers/cmb/cmbPdfPreview';
import { formatAmountFromCent } from '@/utils/format';

const financeStore = useFinanceStore();
const router = useRouter();
const selectedFile = ref<File | null>(null);
const selectedFileName = ref('');
const pdfFile = ref<File | null>(null);
const pdfFileName = ref('');
const selectedAccountId = ref('');
const selectedCmbAccountId = ref('');
const parsing = ref(false);
const pdfParsing = ref(false);
const confirming = ref(false);
const cmbConfirming = ref(false);
const message = ref('');
const preview = ref<AlipayPreviewResult | null>(null);
const pdfPreview = ref<CmbPdfPreviewResult | null>(null);
const importHistory = ref<ImportTaskRecord[]>([]);

const alipayFilters = reactive<ImportFilterSettings>({
  skipDuplicates: false,
  skipRefundPairs: false,
  skipZeroAmount: false,
  skipRepaymentAndTransfer: false,
  skipInvestmentFlow: false,
  skipNonSuccess: false,
  skipNoCount: false,
  skipPersonalTransfers: false
});

const cmbFilters = reactive<ImportFilterSettings>({
  skipDuplicates: false,
  skipRefundPairs: false,
  skipZeroAmount: false,
  skipRepaymentAndTransfer: false,
  skipInvestmentFlow: false,
  skipNonSuccess: false,
  skipNoCount: false,
  skipPersonalTransfers: false
});

onMounted(async () => {
  await financeStore.loadReferenceData();
  selectedAccountId.value = financeStore.assetAccounts.find((item) => item.platform === 'alipay')?.id ?? financeStore.assetAccounts[0]?.id ?? '';
  selectedCmbAccountId.value = financeStore.assetAccounts.find((item) => item.platform === 'cmb')?.id ?? financeStore.assetAccounts[0]?.id ?? '';
  await loadImportHistory();
});

const alipayReadyCount = computed(() => preview.value?.items.filter((item) => item.willImport).length ?? 0);
const alipaySkippedCount = computed(() => preview.value?.items.filter((item) => !item.willImport).length ?? 0);
const pdfReadyCount = computed(() => pdfPreview.value?.entries.filter((item) => item.willImport).length ?? 0);
const pdfSkippedCount = computed(() => pdfPreview.value?.entries.filter((item) => !item.willImport).length ?? 0);

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  selectedFile.value = file;
  selectedFileName.value = file?.name ?? '';
  message.value = '';
}

function handlePdfSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  pdfFile.value = file;
  pdfFileName.value = file?.name ?? '';
  message.value = '';
}

async function parseSelectedFile() {
  if (!selectedFile.value) {
    message.value = '请先选择支付宝 CSV 文件。';
    return;
  }

  parsing.value = true;
  message.value = '';

  try {
    preview.value = await parseAlipayCsvFile(selectedFile.value, financeStore.categories);
    applyAlipayFilters();
    await loadImportHistory();
    message.value = '支付宝账单解析完成，已经把原始候选都展示出来了。';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '解析失败，请检查文件格式。';
  } finally {
    parsing.value = false;
  }
}

async function confirmImport() {
  if (!preview.value) {
    message.value = '请先解析账单文件。';
    return;
  }

  confirming.value = true;
  message.value = '';

  try {
    const importedCount = await confirmAlipayImport(preview.value.task.id, preview.value.items, selectedAccountId.value);
    await loadImportHistory();
    const firstImported = preview.value.items.find((item) => item.willImport);
    message.value = `导入完成，新增 ${importedCount} 条支付宝记录。`;
    clearPreview();
    if (firstImported) {
      await router.push({ name: 'ledger', query: { month: firstImported.occurredAt.slice(0, 7) } });
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入失败，请稍后重试。';
  } finally {
    confirming.value = false;
  }
}

function clearPreview() {
  preview.value = null;
  selectedFile.value = null;
  selectedFileName.value = '';
}

async function parsePdfPreview() {
  if (!pdfFile.value) {
    message.value = '请先选择招商银行 PDF 文件。';
    return;
  }

  pdfParsing.value = true;
  message.value = '';

  try {
    pdfPreview.value = await extractCmbPdfPreview(pdfFile.value, financeStore.categories);
    applyCmbFilters();
    await loadImportHistory();
    message.value = '招商 PDF 解析完成，原始候选已全部展示。';
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'PDF 文本抽取失败。';
  } finally {
    pdfParsing.value = false;
  }
}

function clearPdfPreview() {
  pdfPreview.value = null;
  pdfFile.value = null;
  pdfFileName.value = '';
}

async function confirmCmbPdfImport() {
  if (!pdfPreview.value) {
    message.value = '请先抽取招商银行 PDF。';
    return;
  }

  cmbConfirming.value = true;
  message.value = '';

  try {
    const importedCount = await confirmCmbImport(pdfPreview.value.task.id, pdfPreview.value.entries, selectedCmbAccountId.value);
    await loadImportHistory();
    const firstImported = pdfPreview.value.entries.find((item) => item.willImport);
    message.value = `招商账单导入完成，新增 ${importedCount} 条记录。`;
    clearPdfPreview();
    if (firstImported) {
      await router.push({ name: 'ledger', query: { month: firstImported.occurredAt.slice(0, 7) } });
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : '招商账单导入失败。';
  } finally {
    cmbConfirming.value = false;
  }
}

function applyAlipayFilters() {
  if (!preview.value) {
    return;
  }

  preview.value.items.forEach((item) => {
    const reasons: string[] = [];
    if (alipayFilters.skipDuplicates && item.ruleTags.includes('duplicate')) reasons.push('检测到重复账目');
    if (alipayFilters.skipRefundPairs && item.ruleTags.includes('refund_pair')) reasons.push('识别为退款配对');
    if (alipayFilters.skipZeroAmount && item.ruleTags.includes('zero_amount')) reasons.push('金额为 0');
    if (alipayFilters.skipNoCount && item.ruleTags.includes('no_count')) reasons.push('不计收支');
    if (alipayFilters.skipNonSuccess && item.ruleTags.includes('status')) reasons.push('状态不是交易成功');
    if (alipayFilters.skipRepaymentAndTransfer && item.ruleTags.includes('non_consumption')) reasons.push('识别为非消费类流水');
    item.willImport = reasons.length === 0;
    item.skipReason = reasons[0];
  });
}

function applyCmbFilters() {
  if (!pdfPreview.value) {
    return;
  }

  pdfPreview.value.entries.forEach((entry) => {
    const reasons: string[] = [];
    if (cmbFilters.skipDuplicates && entry.ruleTags.includes('duplicate')) reasons.push('检测到重复账目');
    if (cmbFilters.skipRefundPairs && entry.ruleTags.includes('refund_pair')) reasons.push('识别为退款配对');
    if (cmbFilters.skipZeroAmount && entry.ruleTags.includes('zero_amount')) reasons.push('金额为 0');
    if (cmbFilters.skipRepaymentAndTransfer && (entry.ruleTags.includes('repayment') || entry.ruleTags.includes('transfer'))) {
      reasons.push('按设置跳过还款/转账');
    }
    if (cmbFilters.skipInvestmentFlow && entry.ruleTags.includes('investment')) reasons.push('按设置跳过理财/资金调拨');
    if (cmbFilters.skipPersonalTransfers && entry.ruleTags.includes('personal_transfer')) reasons.push('按设置跳过疑似个人转账');
    entry.willImport = reasons.length === 0;
    entry.skipReason = reasons[0];
  });
}

function toggleAlipayItem(item: AlipayPreviewItem) {
  item.willImport = !item.willImport;
  item.skipReason = item.willImport ? undefined : '手动改为跳过';
}

function toggleCmbItem(entry: CmbParsedEntry) {
  entry.willImport = !entry.willImport;
  entry.skipReason = entry.willImport ? undefined : '手动改为跳过';
}

function setAllAlipayImport(value: boolean) {
  if (!preview.value) {
    return;
  }

  preview.value.items.forEach((item) => {
    item.willImport = value;
    item.skipReason = value ? undefined : '批量改为跳过';
  });
}

function setAllCmbImport(value: boolean) {
  if (!pdfPreview.value) {
    return;
  }

  pdfPreview.value.entries.forEach((entry) => {
    entry.willImport = value;
    entry.skipReason = value ? undefined : '批量改为跳过';
  });
}

async function loadImportHistory() {
  importHistory.value = await db.importTasks.orderBy('createdAt').reverse().limit(8).toArray();
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hour}:${minute}`;
}
</script>
