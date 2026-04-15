<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">账单分析</p>
        <!-- <h1>图表</h1> -->
        <!-- <p class="page__desc">先看月份趋势，再下钻到那个月份的分类和明细。</p> -->
      </div>
    </header>

    <SectionCard title="月度支出曲线">
      <div class="form-grid">
        <label class="field">
          <span>开始月份</span>
          <input v-model="startMonth" type="month" />
        </label>
        <label class="field">
          <span>结束月份</span>
          <input v-model="endMonth" type="month" />
        </label>
      </div>
      <div class="preview-toolbar">
        <span>当前选中 {{ selectedMonthLabel }}</span>
        <button class="text-button" @click="resetRange">恢复近 12 个月</button>
      </div>
      <div
        v-if="hasExpenseTrend"
        ref="expenseTrendChartRef"
        class="echart"
      ></div>
      <p v-else class="form-message">当前月份范围内还没有支出数据。</p>
    </SectionCard>

    <SectionCard title="支出排行占比" :caption="selectedMonthLabel">
      <div class="rank-list">
        <div
          v-for="item in selectedRanking"
          :key="item.categoryId"
          class="rank-entry"
        >
          <button
            class="rank-item rank-item--button"
            @click="toggleCategory(item.categoryId)"
          >
            <div class="rank-item__icon"><AppIcon :name="item.icon" /></div>
            <div>
              <div class="rank-item__title">
                {{ item.name }} {{ formatShare(item.share) }}
              </div>
              <div class="rank-item__bar">
                <span
                  :style="{ width: `${Math.max(item.share * 100, 6)}%` }"
                ></span>
              </div>
            </div>
            <div class="rank-item__amount">
              {{ formatAmountFromCent(item.amount) }}
            </div>
          </button>

          <div
            v-if="expandedCategoryId === item.categoryId"
            class="rank-detail-list"
          >
            <div
              v-for="detail in item.details"
              :key="detail.id"
              class="rank-detail-item"
            >
              <span class="rank-detail-item__date">{{
                formatDetailDate(detail.occurredAt)
              }}</span>
              <span
                class="rank-detail-item__text"
                :title="
                  detail.note
                    ? `${detail.merchant}${detail.note}`
                    : detail.merchant
                "
              >
                <strong class="rank-detail-item__merchant">{{
                  detail.merchant
                }}</strong
                ><span v-if="detail.note" class="rank-detail-item__note">{{
                  detail.note
                }}</span>
              </span>
              <span class="rank-detail-item__amount">{{
                formatAmountFromCent(detail.amount)
              }}</span>
            </div>
          </div>
        </div>
        <p v-if="selectedRanking.length === 0" class="form-message">
          这个月还没有支出排行数据。
        </p>
      </div>
    </SectionCard>

    <SectionCard title="月度 / 年度账单汇总">
      <div class="segmented segmented--two">
        <button
          :class="{ 'is-active': billMode === 'month' }"
          @click="billMode = 'month'"
        >
          月度账单
        </button>
        <button
          :class="{ 'is-active': billMode === 'year' }"
          @click="billMode = 'year'"
        >
          年度账单
        </button>
      </div>

      <div class="bill-list">
        <div class="bill-list__head">
          <span>{{ billMode === "month" ? "月份" : "年份" }}</span>
          <span>收入</span>
          <span>支出</span>
          <span>结余</span>
        </div>

        <div v-if="billMode === 'month'">
          <div
            v-for="item in stats.monthlyBills"
            :key="item.monthKey"
            class="bill-item"
          >
            <span>{{ item.label }}</span>
            <span>{{ formatAmountFromCent(item.income) }}</span>
            <span>{{ formatAmountFromCent(item.expense) }}</span>
            <strong :class="{ 'is-negative': item.balance < 0 }">{{
              formatAmountFromCent(item.balance)
            }}</strong>
          </div>
        </div>

        <div v-else>
          <div
            v-for="item in stats.yearlyBills"
            :key="item.year"
            class="bill-item"
          >
            <span>{{ item.label }}</span>
            <span>{{ formatAmountFromCent(item.income) }}</span>
            <span>{{ formatAmountFromCent(item.expense) }}</span>
            <strong :class="{ 'is-negative': item.balance < 0 }">{{
              formatAmountFromCent(item.balance)
            }}</strong>
          </div>
        </div>
      </div>
    </SectionCard>
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
import { init, use, graphic, type EChartsType } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import AppIcon from "@/components/base/AppIcon.vue";
import SectionCard from "@/components/base/SectionCard.vue";
import {
  getStatsPageData,
  type CategoryRankingItem,
  type MonthBreakdownItem,
  type StatsPageResult,
} from "@/services/statistics/financeStats";
import { formatAmountFromCent } from "@/utils/format";

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const stats = reactive<StatsPageResult>({
  monthBreakdowns: [],
  monthlyBills: [],
  yearlyBills: [],
});

const billMode = ref<"month" | "year">("month");
const expenseTrendChartRef = ref<HTMLDivElement | null>(null);
const startMonth = ref("");
const endMonth = ref("");
const selectedMonthKey = ref("");
const expandedCategoryId = ref("");
let expenseTrendChart: EChartsType | null = null;

onMounted(async () => {
  const result = await getStatsPageData();
  Object.assign(stats, result);
  const range = createDefaultRange();
  startMonth.value = range.start;
  endMonth.value = range.end;
  selectedMonthKey.value = range.end;
  await nextTick();
  renderExpenseTrendChart();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  expenseTrendChart?.dispose();
});

watch(
  () => [startMonth.value, endMonth.value, stats.monthBreakdowns],
  async () => {
    if (
      !rangedBreakdowns.value.some(
        (item) => item.monthKey === selectedMonthKey.value,
      )
    ) {
      selectedMonthKey.value =
        rangedBreakdowns.value[rangedBreakdowns.value.length - 1]?.monthKey ??
        "";
      expandedCategoryId.value = "";
    }
    await nextTick();
    renderExpenseTrendChart();
  },
  { deep: true },
);

const rangedBreakdowns = computed(() => {
  if (!startMonth.value || !endMonth.value) {
    return stats.monthBreakdowns;
  }

  const start =
    startMonth.value <= endMonth.value ? startMonth.value : endMonth.value;
  const end =
    startMonth.value <= endMonth.value ? endMonth.value : startMonth.value;

  return stats.monthBreakdowns.filter(
    (item) => item.monthKey >= start && item.monthKey <= end,
  );
});

const selectedBreakdown = computed<MonthBreakdownItem | null>(
  () =>
    rangedBreakdowns.value.find(
      (item) => item.monthKey === selectedMonthKey.value,
    ) ??
    rangedBreakdowns.value[rangedBreakdowns.value.length - 1] ??
    null,
);

const selectedRanking = computed<CategoryRankingItem[]>(
  () => selectedBreakdown.value?.rankings ?? [],
);
const selectedMonthLabel = computed(
  () => selectedBreakdown.value?.label ?? "未选月份",
);
const hasExpenseTrend = computed(() =>
  rangedBreakdowns.value.some((item) => item.expense > 0),
);

function createDefaultRange() {
  const now = new Date();
  const end = now.toISOString().slice(0, 7);
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const start = startDate.toISOString().slice(0, 7);
  return { start, end };
}

function formatShare(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDetailDate(value: string) {
  return value.slice(5, 10);
}

function handleResize() {
  expenseTrendChart?.resize();
}

function toYuan(value: number) {
  return Number((value / 100).toFixed(2));
}

function toggleCategory(categoryId: string) {
  expandedCategoryId.value =
    expandedCategoryId.value === categoryId ? "" : categoryId;
}

function resetRange() {
  const range = createDefaultRange();
  startMonth.value = range.start;
  endMonth.value = range.end;
  selectedMonthKey.value = range.end;
  expandedCategoryId.value = "";
}

function renderExpenseTrendChart() {
  if (!expenseTrendChartRef.value || rangedBreakdowns.value.length === 0) {
    expenseTrendChart?.dispose();
    expenseTrendChart = null;
    return;
  }

  expenseTrendChart ??= init(expenseTrendChartRef.value);
  expenseTrendChart.off("click");
  expenseTrendChart.on("click", (params) => {
    const dataIndex = Number(params.dataIndex);
    const point = rangedBreakdowns.value[dataIndex];
    if (!point) {
      return;
    }
    selectedMonthKey.value = point.monthKey;
    expandedCategoryId.value = "";
  });

  expenseTrendChart.setOption({
    animationDuration: 500,
    grid: { left: 10, right: 10, top: 24, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(37, 31, 23, 0.92)",
      borderWidth: 0,
      padding: [8, 10],
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: Array<{ axisValueLabel: string; value: number }>) => {
        const current = params[0];
        return `${current.axisValueLabel}<br/>支出 ${current.value.toFixed(2)}`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rangedBreakdowns.value.map((item) => item.label),
      axisLine: { lineStyle: { color: "rgba(125, 112, 97, 0.16)" } },
      axisTick: { show: false },
      axisLabel: { color: "#8a7d70", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        show: true,
        color: "#8a7d70",
        fontSize: 11,
        formatter: (value: number) => `${value.toFixed(0)}`,
      },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: {
        lineStyle: { color: "rgba(125, 112, 97, 0.12)", type: "dashed" },
      },
    },
    series: [
      {
        type: "line",
        smooth: true,
        data: rangedBreakdowns.value.map((item) => toYuan(item.expense)),
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color: "#8c7f71" },
        itemStyle: {
          color: (params: { dataIndex: number }) =>
            rangedBreakdowns.value[params.dataIndex]?.monthKey ===
            selectedMonthKey.value
              ? "#f4b400"
              : "#d7c6af",
          borderColor: "#6f5a38",
          borderWidth: 1.5,
        },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(244, 180, 0, 0.24)" },
            { offset: 1, color: "rgba(244, 180, 0, 0.02)" },
          ]),
        },
      },
    ],
  });
}
</script>
