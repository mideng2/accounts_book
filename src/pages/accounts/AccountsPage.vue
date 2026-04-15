<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">账户管理</p>
        <h1>账户</h1>
        <p class="page__desc">维护资产与负债账户，后续记账和资产快照都会使用这里的配置。</p>
      </div>
    </header>

    <SectionCard title="新建账户" caption="首版支持最常见的手动维护账户">
      <div class="segmented segmented--two">
        <button :class="{ 'is-active': form.kind === 'asset' }" @click="form.kind = 'asset'">资产</button>
        <button :class="{ 'is-active': form.kind === 'liability' }" @click="form.kind = 'liability'">负债</button>
      </div>
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>账户名称</span>
          <input v-model="form.name" type="text" placeholder="比如 微信 / 现金钱包 / 房贷" />
        </label>
        <label class="field">
          <span>账户类型</span>
          <select v-model="form.platform">
            <option value="alipay">支付宝</option>
            <option value="cmb">招商银行</option>
            <option value="cash">现金</option>
            <option value="credit_card">信用卡</option>
            <option value="manual">手动账户</option>
          </select>
        </label>
        <label class="field field--full">
          <span>初始余额</span>
          <input v-model="form.balance" type="number" min="0" step="0.01" placeholder="0.00" />
        </label>
      </div>
      <div class="action-row">
        <button class="action-button action-button--ghost" @click="resetForm">重置</button>
        <button class="action-button" :disabled="saving" @click="submitForm">
          {{ saving ? '保存中...' : '新增账户' }}
        </button>
      </div>
      <p v-if="message" class="form-message">{{ message }}</p>
    </SectionCard>

    <SectionCard title="已有账户" caption="当前本地账本使用中的账户">
      <div class="account-list">
        <div v-for="item in financeStore.accounts" :key="item.id" class="account-item">
          <div class="account-item__icon"><AppIcon :name="accountIcon(item.platform)" /></div>
          <div>
            <div class="account-item__title">{{ item.name }}</div>
            <div class="account-item__meta">{{ item.kind === 'asset' ? '资产账户' : '负债账户' }}</div>
          </div>
          <div class="account-item__amount" :class="{ 'is-negative': item.kind === 'liability' }">
            {{ formatAmountFromCent(item.balance) }}
          </div>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/base/AppIcon.vue';
import SectionCard from '@/components/base/SectionCard.vue';
import { useFinanceStore } from '@/app/store/finance';
import { formatAmountFromCent } from '@/utils/format';

const financeStore = useFinanceStore();
const saving = ref(false);
const message = ref('');

const form = reactive({
  name: '',
  kind: 'asset' as 'asset' | 'liability',
  platform: 'manual' as 'cash' | 'alipay' | 'cmb' | 'credit_card' | 'manual',
  balance: ''
});

onMounted(async () => {
  await financeStore.loadReferenceData();
});

function resetForm() {
  form.name = '';
  form.kind = 'asset';
  form.platform = 'manual';
  form.balance = '';
  message.value = '';
}

async function submitForm() {
  if (!form.name.trim()) {
    message.value = '请填写账户名称。';
    return;
  }

  const balance = Number(form.balance || 0);
  if (!Number.isFinite(balance) || balance < 0) {
    message.value = '请输入正确的初始余额。';
    return;
  }

  saving.value = true;
  message.value = '';

  try {
    await financeStore.createAccount({
      name: form.name,
      kind: form.kind,
      platform: form.platform,
      balance: Math.round(balance * 100)
    });
    message.value = '账户已新增。';
    resetForm();
  } finally {
    saving.value = false;
  }
}

function accountIcon(platform: string) {
  switch (platform) {
    case 'alipay':
      return 'alipay';
    case 'cmb':
      return 'cmb';
    case 'cash':
      return 'cash';
    case 'credit_card':
      return 'credit_card';
    default:
      return 'manual';
  }
}
</script>
