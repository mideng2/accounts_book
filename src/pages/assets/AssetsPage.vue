<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">净资产总览</p>
      </div>
    </header>

    <section class="hero-card">
      <div class="hero-card__heading">净资产</div>
      <div class="hero-card__value">{{ totals.netAsset }}</div>
      <div class="hero-card__grid">
        <div>
          <span>资产</span>
          <strong>{{ totals.asset }}</strong>
        </div>
        <div>
          <span>负债</span>
          <strong>{{ totals.liability }}</strong>
        </div>
        <div>
          <span>本月变化</span>
          <strong>{{ snapshotLabel }}</strong>
        </div>
      </div>
    </section>

    <SectionCard title="资产类型" caption="">
      <div class="account-manage-list">
        <button
          v-for="item in accounts"
          :key="item.id"
          class="account-manage-item"
          type="button"
          @click="startEditAccount(item.id)"
        >
          <div class="account-item__icon">
            <AppIcon :name="accountIcon(item.platform)" />
          </div>
          <div>
            <div class="account-item__title">{{ item.name }}</div>
            <div class="account-item__meta">
              {{ item.kind === "liability" ? "负债账户" : "资产账户" }} ·
              {{ platformLabel(item.platform) }}
            </div>
          </div>
          <div class="account-manage-item__side">
            <strong
              class="account-item__amount"
              :class="{ 'is-negative': item.kind === 'liability' }"
            >
              {{ formatAmountFromCent(item.balance) }}
            </strong>
            <div class="account-manage-item__actions">
              <button
                class="mini-text-button"
                type="button"
                title="上移"
                @click.stop="moveAccount(item.id, 'up')"
              >
                上移
              </button>
              <button
                class="mini-text-button"
                type="button"
                title="下移"
                @click.stop="moveAccount(item.id, 'down')"
              >
                下移
              </button>
              <span>编辑</span>
            </div>
          </div>
        </button>
      </div>
      <p v-if="accountMessage" class="form-message">{{ accountMessage }}</p>
      <div class="account-toolbar">
        <button class="action-button" type="button" @click="openCreateModal">
          新增资产类型
        </button>
      </div>
    </SectionCard>

    <SectionCard title="快照操作" caption="">
      <div class="form-grid">
        <label class="field">
          <span>走势起始月份</span>
          <input v-model="trendStartMonth" type="month" />
        </label>
        <label class="field field--full">
          <span>快照备注</span>
          <input
            v-model="snapshotNote"
            type="text"
            placeholder="比如 6 月中旬资产校准"
          />
        </label>
      </div>
      <div class="action-row">
        <button
          class="action-button action-button--ghost"
          :disabled="saving || !hasRestorableSnapshot"
          @click="restoreLatestSnapshot"
        >
          还原上次快照
        </button>
        <button
          class="action-button"
          :disabled="saving"
          @click="recordSnapshot"
        >
          {{ saving ? "处理中..." : "记录快照" }}
        </button>
      </div>
      <p v-if="message" class="form-message">{{ message }}</p>
    </SectionCard>

    <SectionCard title="资产走势" caption="按月展示每个月最后一次快照的净资产">
      <div v-if="monthlyTrendSnapshots.length > 0" ref="assetTrendChartRef" class="echart"></div>
      <div v-else class="chart-empty">从当前起始月份开始，还没有可用于绘制走势的资产快照。</div>
    </SectionCard>

    <SectionCard title="最近快照" caption="">
      <div class="snapshot-list">
        <div
          v-for="item in recentSnapshots"
          :key="item.id"
          class="snapshot-item"
        >
          <div>
            <div class="snapshot-item__title">
              {{ formatSnapshotDate(item.snapshotDate) }}
            </div>
            <div class="snapshot-item__meta">
              {{ item.note || "未填写备注" }}
            </div>
          </div>
          <div class="snapshot-item__amount">
            {{ formatAmountFromCent(item.netAsset) }}
          </div>
        </div>
      </div>
    </SectionCard>

    <Teleport to="body">
      <div v-if="showModal" class="sheet-backdrop" @click="closeModal"></div>
      <section v-if="showModal" class="sheet" @click.stop>
        <div class="sheet__handle"></div>
        <header class="sheet__header">
          <div>
            <strong>{{
              editingAccountId ? "编辑资产类型" : "新增资产类型"
            }}</strong>
          </div>
          <button class="text-button" type="button" @click="closeModal">
            关闭
          </button>
        </header>

        <div class="segmented segmented--two">
          <button
            :class="{ 'is-active': accountForm.kind === 'asset' }"
            @click="accountForm.kind = 'asset'"
          >
            资产
          </button>
          <button
            :class="{ 'is-active': accountForm.kind === 'liability' }"
            @click="accountForm.kind = 'liability'"
          >
            负债
          </button>
        </div>

        <div class="form-grid" style="margin-top: 12px">
          <label class="field">
            <span>名称</span>
            <input
              v-model="accountForm.name"
              type="text"
              placeholder="比如 支付宝 / 招商储蓄卡 / 房贷"
            />
          </label>
          <label class="field">
            <span>类型</span>
            <select v-model="accountForm.platform">
              <option value="alipay">支付宝</option>
              <option value="cmb">招商银行</option>
              <option value="cash">现金</option>
              <option value="credit_card">信用卡</option>
              <option value="manual">自定义</option>
            </select>
          </label>
          <label class="field field--full">
            <span>{{ editingAccountId ? "当前余额" : "初始余额" }}</span>
            <input
              v-model="accountForm.balance"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </label>
        </div>

        <p v-if="modalMessage" class="form-message">{{ modalMessage }}</p>

        <div class="action-row action-row--editor">
          <button
            v-if="editingAccountId"
            class="action-button action-button--danger"
            type="button"
            :disabled="accountSaving"
            @click="removeAccount"
          >
            删除该资产
          </button>
          <button
            class="action-button action-button--ghost"
            type="button"
            @click="closeModal"
          >
            关闭
          </button>
          <button
            class="action-button"
            type="button"
            :disabled="accountSaving"
            @click="submitAccountForm"
          >
            {{
              accountSaving
                ? "保存中..."
                : editingAccountId
                  ? "保存修改"
                  : "新增类型"
            }}
          </button>
        </div>
      </section>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { init, graphic, use, type EChartsType } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import AppIcon from "@/components/base/AppIcon.vue";
import SectionCard from "@/components/base/SectionCard.vue";
import { useFinanceStore } from "@/app/store/finance";
import { formatAmountFromCent } from "@/utils/format";

const SNAPSHOT_BALANCES_KEY = "money-latest-snapshot-balances";

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const financeStore = useFinanceStore();
const snapshotLabel = ref("--");
const message = ref("");
const saving = ref(false);
const snapshotNote = ref("");
const hasRestorableSnapshot = ref(false);
const trendStartMonth = ref("");
const assetTrendChartRef = ref<HTMLDivElement | null>(null);
let assetTrendChart: EChartsType | null = null;

const showModal = ref(false);
const accountSaving = ref(false);
const accountMessage = ref("");
const modalMessage = ref("");
const editingAccountId = ref("");
const accountForm = reactive({
  name: "",
  kind: "asset" as "asset" | "liability",
  platform: "manual" as "cash" | "alipay" | "cmb" | "credit_card" | "manual",
  balance: "",
});

onMounted(async () => {
  await financeStore.loadReferenceData();
  syncRestorableState();
  initializeTrendStartMonth();
  await nextTick();
  renderAssetTrendChart();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  assetTrendChart?.dispose();
});

const accounts = computed(() => financeStore.accounts);
const recentSnapshots = computed(() => financeStore.assetSnapshots.slice(0, 5));
const monthlyTrendSnapshots = computed(() => {
  const map = new Map<string, (typeof financeStore.assetSnapshots)[number]>();
  const start = trendStartMonth.value || "0000-00";

  for (const item of [...financeStore.assetSnapshots].reverse()) {
    const monthKey = item.snapshotDate.slice(0, 7);

    if (monthKey < start) {
      continue;
    }

    map.set(monthKey, item);
  }

  return [...map.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([monthKey, item]) => ({
      monthKey,
      label: `${monthKey.slice(0, 4)}-${monthKey.slice(5, 7)}`,
      netAsset: item.netAsset,
      totalAsset: item.totalAsset,
      totalLiability: item.totalLiability,
    }));
});
const totals = computed(() => {
  let asset = 0;
  let liability = 0;

  for (const item of financeStore.accounts) {
    if (item.kind === "asset") {
      asset += item.balance;
    } else {
      liability += item.balance;
    }
  }

  return {
    asset: formatAmountFromCent(asset),
    liability: formatAmountFromCent(liability),
    netAsset: formatAmountFromCent(asset - liability),
  };
});

watch(
  recentSnapshots,
  (value) => {
    snapshotLabel.value = value[0]?.note || "已记录";
  },
  { immediate: true },
);

watch(
  () => [trendStartMonth.value, financeStore.assetSnapshots],
  async () => {
    await nextTick();
    renderAssetTrendChart();
  },
  { deep: true },
);

function initializeTrendStartMonth() {
  const earliest = [...financeStore.assetSnapshots]
    .reverse()[0]
    ?.snapshotDate.slice(0, 7);

  trendStartMonth.value =
    earliest || new Date().toISOString().slice(0, 7);
}

function syncRestorableState() {
  hasRestorableSnapshot.value = Boolean(readLatestSnapshotBalances());
}

function resetAccountForm() {
  editingAccountId.value = "";
  modalMessage.value = "";
  accountForm.name = "";
  accountForm.kind = "asset";
  accountForm.platform = "manual";
  accountForm.balance = "";
}

function openCreateModal() {
  resetAccountForm();
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  resetAccountForm();
}

function startEditAccount(accountId: string) {
  const target = financeStore.accounts.find((item) => item.id === accountId);

  if (!target) {
    return;
  }

  editingAccountId.value = target.id;
  modalMessage.value = "";
  accountForm.name = target.name;
  accountForm.kind = target.kind;
  accountForm.platform = target.platform;
  accountForm.balance = (target.balance / 100).toFixed(2);
  showModal.value = true;
}

async function submitAccountForm() {
  if (!accountForm.name.trim()) {
    modalMessage.value = "请填写资产类型名称。";
    return;
  }

  const balance = Number(accountForm.balance || 0);
  if (!Number.isFinite(balance) || balance < 0) {
    modalMessage.value = "请输入正确的余额。";
    return;
  }

  accountSaving.value = true;
  modalMessage.value = "";
  accountMessage.value = "";

  try {
    const payload = {
      name: accountForm.name,
      kind: accountForm.kind,
      platform: accountForm.platform,
      balance: Math.round(balance * 100),
    };

    if (editingAccountId.value) {
      await financeStore.updateAccount({
        id: editingAccountId.value,
        ...payload,
      });
      accountMessage.value = "资产类型已更新。";
    } else {
      await financeStore.createAccount(payload);
      accountMessage.value = "资产类型已新增。";
    }

    closeModal();
  } finally {
    accountSaving.value = false;
  }
}

async function removeAccount() {
  if (!editingAccountId.value) {
    return;
  }

  const ok = window.confirm("确认删除这个资产类型吗？");
  if (!ok) {
    return;
  }

  accountSaving.value = true;
  modalMessage.value = "";
  accountMessage.value = "";

  try {
    await financeStore.deleteAccount(editingAccountId.value);
    accountMessage.value = "资产类型已删除。";
    closeModal();
  } catch (error) {
    modalMessage.value =
      error instanceof Error ? error.message : "删除失败，请稍后再试。";
  } finally {
    accountSaving.value = false;
  }
}

async function moveAccount(accountId: string, direction: "up" | "down") {
  accountMessage.value = "";
  await financeStore.moveAccount(accountId, direction);
}

async function recordSnapshot() {
  saving.value = true;
  message.value = "";

  try {
    await financeStore.createAssetSnapshot(snapshotNote.value);
    writeLatestSnapshotBalances();
    syncRestorableState();
    if (!trendStartMonth.value) {
      initializeTrendStartMonth();
    }
    message.value = "已记录当前资产快照。";
    snapshotNote.value = "";
  } finally {
    saving.value = false;
  }
}

async function restoreLatestSnapshot() {
  const snapshot = readLatestSnapshotBalances();

  if (!snapshot?.balances) {
    message.value = "还没有可还原的快照。";
    return;
  }

  saving.value = true;
  message.value = "";

  try {
    for (const item of financeStore.accounts) {
      const balance = snapshot.balances[item.id];

      if (typeof balance === "number") {
        await financeStore.updateAccountBalance({
          accountId: item.id,
          balance,
        });
      }
    }

    message.value = "已还原到最近一次快照记录的余额。";
  } finally {
    saving.value = false;
  }
}

function writeLatestSnapshotBalances() {
  const balances = Object.fromEntries(
    financeStore.accounts.map((item) => [item.id, item.balance]),
  );

  localStorage.setItem(
    SNAPSHOT_BALANCES_KEY,
    JSON.stringify({
      snapshotDate: new Date().toISOString(),
      balances,
    }),
  );
}

function readLatestSnapshotBalances(): {
  snapshotDate: string;
  balances: Record<string, number>;
} | null {
  const raw = localStorage.getItem(SNAPSHOT_BALANCES_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      snapshotDate: string;
      balances: Record<string, number>;
    };
  } catch {
    return null;
  }
}

function formatSnapshotDate(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}-${day} ${hour}:${minute}`;
}

function handleResize() {
  assetTrendChart?.resize();
}

function toYuan(value: number) {
  return Number((value / 100).toFixed(2));
}

function renderAssetTrendChart() {
  if (!assetTrendChartRef.value || monthlyTrendSnapshots.value.length === 0) {
    assetTrendChart?.dispose();
    assetTrendChart = null;
    return;
  }

  assetTrendChart ??= init(assetTrendChartRef.value);

  assetTrendChart.setOption({
    animation: false,
    grid: {
      left: 54,
      right: 32,
      top: 20,
      bottom: 30,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "rgba(37, 31, 23, 0.92)",
      borderWidth: 0,
      padding: 10,
      textStyle: {
        color: "#fff9ee",
        fontSize: 12,
      },
      formatter: (params: Array<{ axisValue: string; data: number }>) => {
        const point = params[0];
        if (!point) {
          return "";
        }

        return `${point.axisValue}<br/>净资产 ${formatAmountFromCent(
          Math.round(point.data * 100),
        )}`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: true,
      data: monthlyTrendSnapshots.value.map((item) => item.label),
      axisLine: {
        lineStyle: {
          color: "rgba(37, 31, 23, 0.1)",
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: "#7d7061",
        fontSize: 11,
        margin: 14,
      },
    },
    yAxis: {
      type: "value",
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: "rgba(37, 31, 23, 0.08)",
        },
      },
      axisLabel: {
        color: "#7d7061",
        fontSize: 11,
        formatter: (value: number) => formatAxisValue(value),
      },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: {
          width: 3,
          color: "#d08d00",
        },
        itemStyle: {
          color: "#f4b400",
          borderColor: "#6e5323",
          borderWidth: 2,
        },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(244, 180, 0, 0.26)" },
            { offset: 1, color: "rgba(244, 180, 0, 0.02)" },
          ]),
        },
        data: monthlyTrendSnapshots.value.map((item) => toYuan(item.netAsset)),
      },
    ],
  });
}

function formatAxisValue(value: number) {
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }

  return `${Math.round(value)}`;
}

function accountIcon(platform: string) {
  switch (platform) {
    case "alipay":
      return "alipay";
    case "cmb":
      return "cmb";
    case "cash":
      return "cash";
    case "credit_card":
      return "credit_card";
    default:
      return "manual";
  }
}

function platformLabel(platform: string) {
  switch (platform) {
    case "alipay":
      return "支付宝";
    case "cmb":
      return "招商银行";
    case "cash":
      return "现金";
    case "credit_card":
      return "信用卡";
    default:
      return "自定义";
  }
}
</script>
