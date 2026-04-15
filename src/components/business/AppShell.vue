<template>
  <div class="app-shell">
    <div class="app-shell__noise"></div>
    <main class="app-shell__content">
      <RouterView />
    </main>
    <nav class="tabbar">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="tabbar__item"
        :class="{ 'tabbar__item--add': item.to === '/add' }"
      >
        <template v-if="item.to === '/add'">
          <span class="tabbar__bubble"><AppIcon :name="item.icon" /></span>
          <span>{{ item.label }}</span>
        </template>
        <template v-else>
          <span class="tabbar__icon"><AppIcon :name="item.icon" /></span>
          <span>{{ item.label }}</span>
        </template>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/base/AppIcon.vue';

const navItems = [
  { to: '/', label: '明细', icon: 'ledger' },
  { to: '/stats', label: '图表', icon: 'chart' },
  { to: '/add', label: '记一笔', icon: 'add' },
  { to: '/assets', label: '资产', icon: 'assets' },
  { to: '/settings', label: '我的', icon: 'profile' }
];
</script>
