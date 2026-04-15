<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="page__eyebrow">我的与设置</p>
        <!-- <h1>我的</h1> -->
        <!-- <p class="page__desc">把常用管理动作收在这里，保持主流程轻快。</p> -->
      </div>
    </header>

    <SectionCard title="基础管理" caption="首版优先做这些">
      <div class="setting-list">
        <RouterLink to="/accounts" class="setting-item">账户管理</RouterLink>
        <RouterLink to="/categories" class="setting-item">分类管理</RouterLink>
        <RouterLink to="/imports" class="setting-item">导入记录</RouterLink>
        <RouterLink to="/backup" class="setting-item">备份与恢复</RouterLink>
      </div>
    </SectionCard>

    <SectionCard title="产品原则" caption="避免把它做重">
      <ul class="plain-list">
        <li>只记录真实消费和必要收入</li>
        <li>信用卡还款不记账</li>
        <li>资产以手动维护为主</li>
        <li>不做服务器与云同步</li>
      </ul>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import SectionCard from "@/components/base/SectionCard.vue";
</script>
