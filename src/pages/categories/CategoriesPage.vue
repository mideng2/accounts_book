<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">分类管理</p>
        <!-- <h1>分类</h1> -->
        <!-- <p class="page__desc">维护收入和支出分类，首版支持新建和启用状态切换。</p> -->
      </div>
    </header>

    <SectionCard title="新建分类" caption="建议优先补你常用的 5 到 10 个分类">
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
      <div class="form-grid" style="margin-top: 12px">
        <label class="field">
          <span>分类名称</span>
          <input
            v-model="form.name"
            type="text"
            placeholder="比如 宠物 / 订阅 / 兼职"
          />
        </label>
        <label class="field field--full">
          <span>颜色</span>
          <input v-model="form.color" type="text" placeholder="#f4b400" />
        </label>
      </div>
      <div class="field" style="margin-top: 12px">
        <span>图标</span>
        <div class="icon-picker-grid">
          <button
            v-for="icon in iconOptions"
            :key="icon.value"
            type="button"
            class="icon-picker-item"
            :class="{ 'icon-picker-item--active': form.icon === icon.value }"
            @click="form.icon = icon.value"
          >
            <span class="icon-picker-item__icon">
              <AppIcon :name="icon.value" />
            </span>
            <span class="icon-picker-item__label">{{ icon.label }}</span>
          </button>
        </div>
      </div>
      <div class="action-row">
        <button class="action-button action-button--ghost" @click="resetForm">
          重置
        </button>
        <button class="action-button" :disabled="saving" @click="submitForm">
          {{ saving ? "保存中..." : "新增分类" }}
        </button>
      </div>
      <p v-if="message" class="form-message">{{ message }}</p>
    </SectionCard>

    <SectionCard title="支出分类" caption="可临时停用，不必删除">
      <div class="toggle-list">
        <div
          v-for="item in financeStore.expenseCategoriesAll"
          :key="item.id"
          class="toggle-item"
        >
          <div class="toggle-item__main">
            <div class="toggle-item__icon"><AppIcon :name="item.icon" /></div>
            <div>
              <div class="toggle-item__title">{{ item.name }}</div>
              <div class="toggle-item__meta">
                {{ item.enabled ? "启用中" : "已停用" }}
              </div>
            </div>
          </div>
          <button
            class="toggle-button"
            :class="{ 'toggle-button--off': !item.enabled }"
            @click="toggle(item.id)"
          >
            {{ item.enabled ? "停用" : "启用" }}
          </button>
        </div>
      </div>
    </SectionCard>

    <SectionCard title="收入分类" caption="和支出分类分开管理">
      <div class="toggle-list">
        <div
          v-for="item in financeStore.incomeCategoriesAll"
          :key="item.id"
          class="toggle-item"
        >
          <div class="toggle-item__main">
            <div class="toggle-item__icon"><AppIcon :name="item.icon" /></div>
            <div>
              <div class="toggle-item__title">{{ item.name }}</div>
              <div class="toggle-item__meta">
                {{ item.enabled ? "启用中" : "已停用" }}
              </div>
            </div>
          </div>
          <button
            class="toggle-button"
            :class="{ 'toggle-button--off': !item.enabled }"
            @click="toggle(item.id)"
          >
            {{ item.enabled ? "停用" : "启用" }}
          </button>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import AppIcon from "@/components/base/AppIcon.vue";
import SectionCard from "@/components/base/SectionCard.vue";
import { useFinanceStore } from "@/app/store/finance";
import {
  categoryIconOptions,
  defaultCategoryIcon,
} from "@/utils/categoryIcons";

const financeStore = useFinanceStore();
const saving = ref(false);
const message = ref("");

const iconOptions = categoryIconOptions;

const form = reactive({
  name: "",
  type: "expense" as "expense" | "income",
  icon: defaultCategoryIcon,
  color: "#f4b400",
});

onMounted(async () => {
  await financeStore.loadReferenceData();
});

function resetForm() {
  form.name = "";
  form.type = "expense";
  form.icon = defaultCategoryIcon;
  form.color = "#f4b400";
  message.value = "";
}

async function submitForm() {
  if (!form.name.trim()) {
    message.value = "请填写分类名称。";
    return;
  }

  saving.value = true;
  message.value = "";

  try {
    await financeStore.createCategory({
      name: form.name,
      type: form.type,
      icon: form.icon,
      color: form.color,
    });
    message.value = "分类已新增。";
    resetForm();
  } finally {
    saving.value = false;
  }
}

async function toggle(categoryId: string) {
  await financeStore.toggleCategoryEnabled(categoryId);
}
</script>
