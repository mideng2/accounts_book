import { createRouter as createVueRouter, createWebHistory } from 'vue-router';
import AppShell from '@/components/business/AppShell.vue';
import LedgerPage from '@/pages/ledger/LedgerPage.vue';
import AddTransactionPage from '@/pages/add/AddTransactionPage.vue';
import AssetsPage from '@/pages/assets/AssetsPage.vue';
import SettingsPage from '@/pages/settings/SettingsPage.vue';
import ImportsPage from '@/pages/imports/ImportsPage.vue';
import AccountsPage from '@/pages/accounts/AccountsPage.vue';
import CategoriesPage from '@/pages/categories/CategoriesPage.vue';
import BackupPage from '@/pages/backup/BackupPage.vue';

export function createRouter() {
  return createVueRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: AppShell,
        children: [
          {
            path: '',
            name: 'ledger',
            component: LedgerPage
          },
          {
            path: 'stats',
            name: 'stats',
            component: () => import('@/pages/stats/StatsPage.vue')
          },
          {
            path: 'add',
            name: 'add',
            component: AddTransactionPage
          },
          {
            path: 'transactions/:id/edit',
            name: 'transaction-edit',
            component: AddTransactionPage
          },
          {
            path: 'assets',
            name: 'assets',
            component: AssetsPage
          },
          {
            path: 'settings',
            name: 'settings',
            component: SettingsPage
          },
          {
            path: 'imports',
            name: 'imports',
            component: ImportsPage
          },
          {
            path: 'accounts',
            name: 'accounts',
            component: AccountsPage
          },
          {
            path: 'categories',
            name: 'categories',
            component: CategoriesPage
          },
          {
            path: 'backup',
            name: 'backup',
            component: BackupPage
          }
        ]
      }
    ]
  });
}
