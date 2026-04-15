<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">{{ monthLabel }}</p>
        <!-- <h1>账本明细</h1>
        <p class="page__desc">导入和手动记账都会落到这里，点一条就能直接改。</p> -->
      </div>
    </header>

    <section class="hero-card">
      <div class="hero-card__grid">
        <div>
          <span>收入</span>
          <strong>{{ summary.income }}</strong>
        </div>
        <div>
          <span>支出</span>
          <strong>{{ summary.expense }}</strong>
        </div>
        <div>
          <span>结余</span>
          <strong>{{ summary.balance }}</strong>
        </div>
      </div>
    </section>

    <SectionCard>
      <div class="month-switch">
        <input
          class="month-switch__input"
          :value="monthInputValue"
          type="month"
          @change="handleMonthChange"
        />
        <button
          class="action-button action-button--ghost"
          @click="goCurrentMonth"
        >
          本月
        </button>
        <button
          class="action-button action-button--ghost"
          @click="shiftMonth(-1)"
        >
          上个月
        </button>
        <button
          class="action-button action-button--ghost"
          @click="shiftMonth(1)"
        >
          下个月
        </button>
      </div>
    </SectionCard>

    <SectionCard
      v-for="group in groupedTransactions"
      :key="group.dateKey"
      :title="group.label"
      :caption="`共 ${group.items.length} 笔`"
    >
      <template #action>
        <div class="day-balance">
          <strong class="day-balance__value">
            {{ group.netAmount < 0 ? "-" : "" }}{{ formatAmountFromCent(Math.abs(group.netAmount)) }}
          </strong>
        </div>
      </template>
      <div class="tx-list">
        <button
          v-for="item in group.items"
          :key="item.id"
          class="tx-item tx-item--button"
          @click="openEditor(item.id)"
        >
          <div class="tx-item__icon"><AppIcon :name="item.categoryIcon" /></div>
          <div>
            <div class="tx-item__title">{{ item.categoryName }}</div>
            <div class="tx-item__meta">
              {{ item.accountName }} ·
              {{ item.merchant || item.note || "手动记账" }}
            </div>
          </div>
          <div
            class="tx-item__amount"
            :class="{ 'tx-item__amount--income': item.type === 'income' }"
          >
            {{ item.type === "income" ? "+" : "-"
            }}{{ formatAmountFromCent(item.amount) }}
          </div>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      v-if="groupedTransactions.length === 0"
      title="这个月还没有记录"
    >
      <div class="empty-state">
        <p>可以切到任意月份查看，也可以先导入或手动记一笔。</p>
      </div>
    </SectionCard>

    <Teleport to="body">
      <div
        v-if="isEditorOpen"
        class="sheet-backdrop"
        @click="closeEditor"
      ></div>
      <section v-if="isEditorOpen" class="sheet">
        <div class="sheet__handle"></div>
        <div class="sheet__header">
          <div>
            <strong>编辑记录</strong>
          </div>
          <button class="text-button" @click="closeEditor">关闭</button>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>金额</span>
            <input
              v-model="editorForm.amount"
              type="number"
              step="0.01"
              placeholder="-46.00 / 2000.00"
            />
          </label>
          <label class="field">
            <span>分类</span>
            <select v-model="editorForm.categoryId">
              <option
                v-for="item in editorCategories"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>账户</span>
            <select v-model="editorForm.accountId">
              <option
                v-for="item in financeStore.assetAccounts"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>日期</span>
            <input v-model="editorForm.occurredAt" type="date" />
          </label>
          <label class="field field--full">
            <span>商户</span>
            <input
              v-model="editorForm.merchant"
              type="text"
              placeholder="比如 滴滴出行 / 京东商城"
            />
          </label>
          <label class="field field--full">
            <span>备注</span>
            <textarea
              v-model="editorForm.note"
              rows="3"
              placeholder="可选"
            ></textarea>
          </label>
        </div>

        <p v-if="editorMessage" class="form-message">{{ editorMessage }}</p>

        <div class="action-row action-row--editor">
          <button
            class="action-button action-button--danger"
            :disabled="savingEdit || deletingEdit"
            @click="deleteEditor"
          >
            {{ deletingEdit ? "删除中..." : "删除" }}
          </button>
          <button
            class="action-button"
            :disabled="savingEdit || deletingEdit || !canSaveEdit"
            @click="saveEditor"
          >
            {{ savingEdit ? "保存中..." : "保存" }}
          </button>
        </div>
      </section>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/base/AppIcon.vue";
import SectionCard from "@/components/base/SectionCard.vue";
import { useFinanceStore } from "@/app/store/finance";
import {
  formatAmountFromCent,
  formatDateGroup,
  formatMonthLabel,
  toLocalDateKey,
} from "@/utils/format";

const financeStore = useFinanceStore();
const route = useRoute();
const router = useRouter();

const isEditorOpen = ref(false);
const editingId = ref("");
const savingEdit = ref(false);
const deletingEdit = ref(false);
const editorMessage = ref("");
const editorForm = reactive({
  amount: "",
  categoryId: "",
  accountId: "",
  occurredAt: "",
  merchant: "",
  note: "",
});

const targetMonth = computed(() => {
  const raw = String(route.query.month ?? "");
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return new Date(`${raw}-01T12:00:00`);
  }

  return new Date();
});

const monthLabel = computed(() => formatMonthLabel(targetMonth.value));
const monthInputValue = computed(() =>
  targetMonth.value.toISOString().slice(0, 7),
);

onMounted(async () => {
  await financeStore.loadReferenceData();
  await financeStore.loadTransactionsForMonth(targetMonth.value);
});

watch(
  () => route.query.month,
  async () => {
    await financeStore.loadTransactionsForMonth(targetMonth.value);
  },
);

watch(
  () => editorForm.amount,
  () => {
    if (!isEditorOpen.value) {
      return;
    }

    const firstCategory = editorCategories.value[0];
    if (
      !editorCategories.value.some((item) => item.id === editorForm.categoryId)
    ) {
      editorForm.categoryId = firstCategory?.id ?? "";
    }
  },
);

const summary = computed(() => {
  let income = 0;
  let expense = 0;

  for (const item of financeStore.transactions) {
    if (item.type === "income") {
      income += item.amount;
    } else {
      expense += item.amount;
    }
  }

  return {
    income: formatAmountFromCent(income),
    expense: formatAmountFromCent(expense),
    balance: formatAmountFromCent(income - expense),
  };
});

const groupedTransactions = computed(() => {
  const groups = new Map<
    string,
    {
      dateKey: string;
      label: string;
      items: typeof financeStore.transactions;
      netAmount: number;
    }
  >();

  for (const item of financeStore.transactions) {
    const dateKey = toLocalDateKey(item.occurredAt);

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        dateKey,
        label: formatDateGroup(item.occurredAt),
        items: [],
        netAmount: 0,
      });
    }

    groups.get(dateKey)!.items.push(item);
    groups.get(dateKey)!.netAmount +=
      item.type === "income" ? item.amount : -item.amount;
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.dateKey < b.dateKey ? 1 : -1,
  );
});

const editorType = computed<"expense" | "income">(() => {
  const amount = Number(editorForm.amount);
  return amount >= 0 ? "income" : "expense";
});

const editorCategories = computed(() =>
  editorType.value === "income"
    ? financeStore.incomeCategories
    : financeStore.expenseCategories,
);

const canSaveEdit = computed(() => {
  const amount = Number(editorForm.amount);
  return Boolean(
    editingId.value &&
    editorForm.accountId &&
    editorForm.categoryId &&
    editorForm.occurredAt &&
    Number.isFinite(amount) &&
    amount !== 0,
  );
});

function shiftMonth(offset: number) {
  const next = new Date(targetMonth.value);
  next.setMonth(next.getMonth() + offset);
  void router.replace({
    name: "ledger",
    query: { month: next.toISOString().slice(0, 7) },
  });
}

function handleMonthChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return;
  }

  void router.replace({
    name: "ledger",
    query: { month: value },
  });
}

function goCurrentMonth() {
  void router.replace({
    name: "ledger",
    query: { month: new Date().toISOString().slice(0, 7) },
  });
}

function openEditor(id: string) {
  const item = financeStore.transactions.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  editingId.value = id;
  editorForm.amount = `${item.type === "income" ? "" : "-"}${(item.amount / 100).toFixed(2)}`;
  editorForm.categoryId = item.categoryId;
  editorForm.accountId = item.accountId;
  editorForm.occurredAt = item.occurredAt.slice(0, 10);
  editorForm.merchant = item.merchant ?? "";
  editorForm.note = item.note ?? "";
  editorMessage.value = "";
  isEditorOpen.value = true;
}

function closeEditor() {
  isEditorOpen.value = false;
  editingId.value = "";
  editorMessage.value = "";
}

async function saveEditor() {
  if (!canSaveEdit.value) {
    editorMessage.value = "请先补全金额、分类、账户和时间。";
    return;
  }

  savingEdit.value = true;
  editorMessage.value = "";

  try {
    const rawAmount = Number(editorForm.amount);
    const current = financeStore.transactions.find(
      (entry) => entry.id === editingId.value,
    );
    const previous = current ? new Date(current.occurredAt) : new Date();
    const occurredAt = new Date(
      `${editorForm.occurredAt}T${String(previous.getHours()).padStart(2, "0")}:${String(previous.getMinutes()).padStart(2, "0")}:00`,
    ).toISOString();

    await financeStore.updateTransaction({
      id: editingId.value,
      type: rawAmount > 0 ? "income" : "expense",
      amount: Math.abs(Math.round(rawAmount * 100)),
      accountId: editorForm.accountId,
      categoryId: editorForm.categoryId,
      occurredAt,
      merchant: editorForm.merchant,
      note: editorForm.note,
    });

    const nextMonth = occurredAt.slice(0, 7);
    if (nextMonth !== monthInputValue.value) {
      await router.replace({ name: "ledger", query: { month: nextMonth } });
    }
    closeEditor();
  } finally {
    savingEdit.value = false;
  }
}

async function deleteEditor() {
  if (!editingId.value) {
    return;
  }

  deletingEdit.value = true;
  editorMessage.value = "";

  try {
    await financeStore.deleteTransaction(editingId.value, targetMonth.value);
    closeEditor();
  } finally {
    deletingEdit.value = false;
  }
}
</script>
