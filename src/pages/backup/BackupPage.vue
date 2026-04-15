<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">备份与恢复</p>
        <h1>数据安全</h1>
        <p class="page__desc">这是一款本地优先的 PWA，所以备份能力不是附属功能，而是核心安全网。</p>
      </div>
    </header>

    <SectionCard title="导出备份" caption="导出全部本地数据为单个 JSON 文件">
      <div class="backup-card">
        <p>包含交易、账户、分类、资产快照、导入任务和导入明细。</p>
        <button class="action-button" :disabled="exporting" @click="handleExport">
          {{ exporting ? '导出中...' : '导出备份文件' }}
        </button>
      </div>
    </SectionCard>

    <SectionCard title="恢复备份" caption="恢复会覆盖当前本地数据，请先确认">
      <div class="backup-card">
        <p>只支持由当前应用导出的 `money-pwa` JSON 备份文件。</p>
        <label class="file-picker">
          <input type="file" accept="application/json,.json" @change="handleFileChange" />
          <span>{{ selectedFileName || '选择备份文件' }}</span>
        </label>
        <button class="action-button action-button--danger" :disabled="restoring || !selectedFile" @click="handleRestore">
          {{ restoring ? '恢复中...' : '覆盖恢复本地数据' }}
        </button>
      </div>
      <p class="form-message">恢复完成后，建议刷新页面确认数据状态。</p>
    </SectionCard>

    <SectionCard title="说明" caption="当前恢复策略">
      <ul class="plain-list">
        <li>恢复是全量覆盖，不做合并。</li>
        <li>恢复成功后会重新加载本地数据。</li>
        <li>建议恢复前先导出一次当前状态作为保险。</li>
      </ul>
    </SectionCard>

    <p v-if="message" class="form-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SectionCard from '@/components/base/SectionCard.vue';
import { useFinanceStore } from '@/app/store/finance';
import { downloadBackupFile, parseBackupFile, restoreBackupPayload } from '@/services/backup/backupService';

const financeStore = useFinanceStore();
const exporting = ref(false);
const restoring = ref(false);
const selectedFile = ref<File | null>(null);
const selectedFileName = ref('');
const message = ref('');

async function handleExport() {
  exporting.value = true;
  message.value = '';

  try {
    const payload = await downloadBackupFile();
    message.value = `导出成功：${payload.exportedAt}`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导出失败，请重试。';
  } finally {
    exporting.value = false;
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  selectedFile.value = file;
  selectedFileName.value = file?.name ?? '';
  message.value = '';
}

async function handleRestore() {
  if (!selectedFile.value) {
    message.value = '请先选择备份文件。';
    return;
  }

  restoring.value = true;
  message.value = '';

  try {
    const payload = await parseBackupFile(selectedFile.value);
    await restoreBackupPayload(payload);
    await financeStore.initialize();
    message.value = '恢复成功，当前本地数据已被备份文件覆盖。';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '恢复失败，请检查备份文件。';
  } finally {
    restoring.value = false;
  }
}
</script>

