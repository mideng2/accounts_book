<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">{{ isEditMode ? "编辑记录" : "快速录入" }}</p>
        <!-- <h1>{{ isEditMode ? "编辑这笔账" : "记一笔" }}</h1> -->
        <!-- <p class="page__desc">导入只是快捷入口，真正的账还是应该能回到这里修正。</p> -->
      </div>
    </header>

    <SectionCard title="类型" caption="首版只做消费口径记账">
      <div class="segmented segmented--two">
        <button
          :class="{ 'is-active': form.type === 'expense' }"
          @click="form.type = 'expense'"
        >
          支出
        </button>
        <button
          :class="{ 'is-active': form.type === 'income' }"
          @click="form.type = 'income'"
        >
          收入
        </button>
      </div>
    </SectionCard>

    <SectionCard title="分类" caption="高频分类先放前面">
      <div class="category-grid">
        <button
          v-for="item in currentCategories"
          :key="item.id"
          class="category-tile category-tile--button"
          :class="{ 'category-tile--active': form.categoryId === item.id }"
          @click="form.categoryId = item.id"
        >
          <div class="category-tile__icon"><AppIcon :name="item.icon" /></div>
          <span>{{ item.name }}</span>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      title="账户与时间"
      caption="导入记录也可以在这里改账户、时间和商户"
    >
      <div class="form-grid">
        <label class="field">
          <span>账户</span>
          <select v-model="form.accountId">
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
          <span>时间</span>
          <input v-model="form.occurredAt" type="date" />
        </label>
        <label class="field field--full">
          <span>商户 / 说明</span>
          <input
            v-model="form.merchant"
            type="text"
            placeholder="比如 面馆午餐 / 地铁出行"
          />
        </label>
        <label class="field field--full">
          <span>备注</span>
          <textarea
            v-model="form.note"
            rows="3"
            placeholder="可选，记录补充信息"
          ></textarea>
        </label>
      </div>
    </SectionCard>

    <SectionCard
      title="金额与保存"
      caption="金额统一按元输入，内部会转成分存储"
    >
      <div class="amount-board">
        <strong>{{ previewAmount }}</strong>
        <p>{{ saveHint }}</p>
      </div>
      <div class="form-grid">
        <label class="field field--full">
          <span>金额</span>
          <input
            v-model="form.amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="46.00"
          />
        </label>
      </div>
      <div class="action-row">
        <button class="action-button action-button--ghost" @click="resetForm">
          {{ isEditMode ? "恢复原值" : "重置" }}
        </button>
        <button
          class="action-button"
          :disabled="saving || !canSubmit"
          @click="submitForm"
        >
          {{ saving ? "保存中..." : isEditMode ? "保存修改" : "保存这笔记录" }}
        </button>
      </div>
      <div v-if="isEditMode" class="action-row" style="margin-top: 10px">
        <button
          class="action-button action-button--danger"
          :disabled="saving || deleting"
          @click="deleteCurrentTransaction"
        >
          {{ deleting ? "删除中..." : "删除这笔记录" }}
        </button>
      </div>
      <p v-if="message" class="form-message">{{ message }}</p>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/base/AppIcon.vue";
import SectionCard from "@/components/base/SectionCard.vue";
import { useFinanceStore } from "@/app/store/finance";
import { db } from "@/db/schema";
import { formatAmountFromCent, toDateValue } from "@/utils/format";

const financeStore = useFinanceStore();
const router = useRouter();
const route = useRoute();
const saving = ref(false);
const deleting = ref(false);
const message = ref("");
const originalTransactionId = computed(() => String(route.params.id ?? ""));

const form = reactive({
  type: "expense" as "expense" | "income",
  categoryId: "",
  accountId: "",
  amount: "",
  occurredAt: toDateValue(new Date().toISOString()),
  merchant: "",
  note: "",
});

const isEditMode = computed(() => Boolean(originalTransactionId.value));

onMounted(async () => {
  await financeStore.loadReferenceData();
  await hydrateForm();
});

watch(
  () => route.params.id,
  async () => {
    await hydrateForm();
  },
);

watch(
  () => form.type,
  () => {
    const firstCategory = currentCategories.value[0];

    if (!currentCategories.value.some((item) => item.id === form.categoryId)) {
      form.categoryId = firstCategory?.id ?? "";
    }
  },
);

const currentCategories = computed(() =>
  form.type === "expense"
    ? financeStore.expenseCategories
    : financeStore.incomeCategories,
);

const previewAmount = computed(() => {
  const amount = Number(form.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "0.00";
  }

  return formatAmountFromCent(Math.round(amount * 100));
});

const canSubmit = computed(() => {
  const amount = Number(form.amount);

  return Boolean(
    form.accountId &&
    form.categoryId &&
    form.occurredAt &&
    Number.isFinite(amount) &&
    amount > 0,
  );
});

const saveHint = computed(() => {
  const category = currentCategories.value.find(
    (item) => item.id === form.categoryId,
  );
  const account = financeStore.assetAccounts.find(
    (item) => item.id === form.accountId,
  );

  return `${category?.name ?? "未选分类"} · ${account?.name ?? "未选账户"}`;
});

async function hydrateForm() {
  message.value = "";

  if (!isEditMode.value) {
    resetToDefaults();
    return;
  }

  const transaction = await db.transactions.get(originalTransactionId.value);

  if (!transaction) {
    message.value = "没有找到这笔记录。";
    resetToDefaults();
    return;
  }

  form.type = transaction.type;
  form.categoryId = transaction.categoryId;
  form.accountId = transaction.accountId;
  form.amount = (transaction.amount / 100).toFixed(2);
  form.occurredAt = toDateValue(transaction.occurredAt);
  form.merchant = transaction.merchant ?? "";
  form.note = transaction.note ?? "";
}

function resetToDefaults() {
  form.amount = "";
  form.merchant = "";
  form.note = "";
  form.occurredAt = toDateValue(new Date().toISOString());
  form.type = "expense";
  form.accountId = financeStore.assetAccounts[0]?.id ?? "";
  form.categoryId = currentCategories.value[0]?.id ?? "";
}

async function resetForm() {
  if (isEditMode.value) {
    await hydrateForm();
    return;
  }

  resetToDefaults();
}

async function submitForm() {
  if (!canSubmit.value) {
    message.value = "请先补全金额、账户、分类和时间。";
    return;
  }

  saving.value = true;
  message.value = "";

  try {
    const payload = {
      type: form.type,
      accountId: form.accountId,
      categoryId: form.categoryId,
      amount: Math.round(Number(form.amount) * 100),
      occurredAt: new Date(`${form.occurredAt}T12:00:00`).toISOString(),
      merchant: form.merchant,
      note: form.note,
    };

    if (isEditMode.value) {
      await financeStore.updateTransaction({
        id: originalTransactionId.value,
        ...payload,
      });
      message.value = "修改已保存，正在返回明细。";
    } else {
      await financeStore.addTransaction(payload);
      message.value = "已保存，正在返回明细页。";
      resetToDefaults();
    }

    await router.push({
      name: "ledger",
      query: { month: payload.occurredAt.slice(0, 7) },
    });
  } finally {
    saving.value = false;
  }
}

async function deleteCurrentTransaction() {
  if (!isEditMode.value) {
    return;
  }

  const confirmed = window.confirm("确认删除这笔记录吗？删除后无法恢复。");
  if (!confirmed) {
    return;
  }

  deleting.value = true;
  message.value = "";

  try {
    const occurredAt = new Date(form.occurredAt).toISOString();
    await financeStore.deleteTransaction(
      originalTransactionId.value,
      new Date(occurredAt),
    );
    await router.push({
      name: "ledger",
      query: { month: occurredAt.slice(0, 7) },
    });
  } finally {
    deleting.value = false;
  }
}
</script>
