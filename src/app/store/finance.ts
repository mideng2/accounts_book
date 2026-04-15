import { defineStore } from 'pinia';
import { db, type AccountRecord, type AssetSnapshotRecord, type CategoryRecord, type TransactionRecord } from '@/db/schema';

export interface TransactionViewRecord extends TransactionRecord {
  accountName: string;
  categoryName: string;
  categoryIcon: string;
}

interface AddTransactionPayload {
  type: 'expense' | 'income';
  amount: number;
  accountId: string;
  categoryId: string;
  occurredAt: string;
  merchant?: string;
  note?: string;
}

interface UpdateTransactionPayload extends AddTransactionPayload {
  id: string;
}

interface UpdateAccountBalancePayload {
  accountId: string;
  balance: number;
}

interface CreateAccountPayload {
  name: string;
  kind: 'asset' | 'liability';
  platform: 'cash' | 'alipay' | 'cmb' | 'credit_card' | 'manual';
  balance: number;
}

interface UpdateAccountPayload extends CreateAccountPayload {
  id: string;
}

interface CreateCategoryPayload {
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useFinanceStore = defineStore('finance', {
  state: () => ({
    ready: false,
    loading: false,
    accounts: [] as AccountRecord[],
    categories: [] as CategoryRecord[],
    transactions: [] as TransactionViewRecord[],
    assetSnapshots: [] as AssetSnapshotRecord[]
  }),
  getters: {
    expenseCategories(state) {
      return state.categories.filter((item) => item.type === 'expense' && item.enabled);
    },
    expenseCategoriesAll(state) {
      return state.categories.filter((item) => item.type === 'expense');
    },
    incomeCategories(state) {
      return state.categories.filter((item) => item.type === 'income' && item.enabled);
    },
    incomeCategoriesAll(state) {
      return state.categories.filter((item) => item.type === 'income');
    },
    assetAccounts(state) {
      return state.accounts.filter((item) => item.kind === 'asset');
    }
  },
  actions: {
    async loadReferenceData() {
      const [accounts, categories, assetSnapshots] = await Promise.all([
        db.accounts.orderBy('sort').toArray(),
        db.categories.orderBy('sort').toArray(),
        db.assetSnapshots.orderBy('snapshotDate').reverse().toArray()
      ]);

      this.accounts = accounts;
      this.categories = categories;
      this.assetSnapshots = assetSnapshots;
      this.ready = true;
    },

    async loadTransactionsForMonth(target = new Date()) {
      this.loading = true;

      const monthStart = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();
      const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 1).toISOString();

      const [transactions, accounts, categories] = await Promise.all([
        db.transactions
          .where('occurredAt')
          .between(monthStart, monthEnd, true, false)
          .reverse()
          .sortBy('occurredAt'),
        db.accounts.toArray(),
        db.categories.toArray()
      ]);

      const accountMap = new Map(accounts.map((item) => [item.id, item]));
      const categoryMap = new Map(categories.map((item) => [item.id, item]));

      this.transactions = [...transactions]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .map((item) => {
          const account = accountMap.get(item.accountId);
          const category = categoryMap.get(item.categoryId);

          return {
            ...item,
            accountName: account?.name ?? '未命名账户',
            categoryName: category?.name ?? '未分类',
            categoryIcon: category?.icon ?? '•'
          };
        });

      this.loading = false;
    },

    async initialize() {
      await this.loadReferenceData();
      await this.loadTransactionsForMonth();
    },

    async addTransaction(payload: AddTransactionPayload) {
      const now = new Date().toISOString();
      const transactionId = createId('tx');

      await db.transactions.add({
        id: transactionId,
        type: payload.type,
        amount: payload.amount,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        occurredAt: payload.occurredAt,
        merchant: payload.merchant?.trim() || undefined,
        note: payload.note?.trim() || undefined,
        source: 'manual',
        sourceId: transactionId,
        createdAt: now,
        updatedAt: now
      });

      await this.loadTransactionsForMonth(new Date(payload.occurredAt));
    },

    async updateTransaction(payload: UpdateTransactionPayload) {
      const target = await db.transactions.get(payload.id);

      if (!target) {
        return;
      }

      await db.transactions.put({
        ...target,
        type: payload.type,
        amount: payload.amount,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        occurredAt: payload.occurredAt,
        merchant: payload.merchant?.trim() || undefined,
        note: payload.note?.trim() || undefined,
        updatedAt: new Date().toISOString()
      });

      await this.loadTransactionsForMonth(new Date(payload.occurredAt));
    },

    async deleteTransaction(transactionId: string, targetDate = new Date()) {
      await db.transactions.delete(transactionId);
      await this.loadTransactionsForMonth(targetDate);
    },

    async updateAccountBalance(payload: UpdateAccountBalancePayload) {
      const target = this.accounts.find((item) => item.id === payload.accountId);

      if (!target) {
        return;
      }

      const nextRecord: AccountRecord = {
        ...target,
        balance: payload.balance,
        updatedAt: new Date().toISOString()
      };

      await db.accounts.put(nextRecord);
      await this.loadReferenceData();
    },

    async createAccount(payload: CreateAccountPayload) {
      const maxSort = this.accounts.reduce((current, item) => Math.max(current, item.sort), 0);
      const now = new Date().toISOString();

      await db.accounts.add({
        id: createId('account'),
        name: payload.name.trim(),
        kind: payload.kind,
        platform: payload.platform,
        balance: payload.balance,
        isManuallyMaintained: true,
        sort: maxSort + 1,
        createdAt: now,
        updatedAt: now
      });

      await this.loadReferenceData();
    },

    async updateAccount(payload: UpdateAccountPayload) {
      const target = this.accounts.find((item) => item.id === payload.id);

      if (!target) {
        return;
      }

      await db.accounts.put({
        ...target,
        name: payload.name.trim(),
        kind: payload.kind,
        platform: payload.platform,
        balance: payload.balance,
        updatedAt: new Date().toISOString()
      });

      await this.loadReferenceData();
    },

    async deleteAccount(accountId: string) {
      const linkedTransactions = await db.transactions.where('accountId').equals(accountId).count();

      if (linkedTransactions > 0) {
        throw new Error('该资产类型已被账目使用，暂时不能删除。');
      }

      await db.accounts.delete(accountId);
      await this.loadReferenceData();
    },

    async moveAccount(accountId: string, direction: 'up' | 'down') {
      const orderedAccounts = [...this.accounts].sort((a, b) => a.sort - b.sort);
      const index = orderedAccounts.findIndex((item) => item.id === accountId);

      if (index === -1) {
        return;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= orderedAccounts.length) {
        return;
      }

      const current = orderedAccounts[index];
      const adjacent = orderedAccounts[targetIndex];

      await db.transaction('rw', db.accounts, async () => {
        await db.accounts.put({
          ...current,
          sort: adjacent.sort,
          updatedAt: new Date().toISOString()
        });

        await db.accounts.put({
          ...adjacent,
          sort: current.sort,
          updatedAt: new Date().toISOString()
        });
      });

      await this.loadReferenceData();
    },

    async createCategory(payload: CreateCategoryPayload) {
      const sameType = this.categories.filter((item) => item.type === payload.type);
      const maxSort = sameType.reduce((current, item) => Math.max(current, item.sort), 0);

      await db.categories.add({
        id: createId('category'),
        name: payload.name.trim(),
        type: payload.type,
        icon: payload.icon,
        color: payload.color,
        sort: maxSort + 1,
        enabled: true
      });

      await this.loadReferenceData();
    },

    async toggleCategoryEnabled(categoryId: string) {
      const target = this.categories.find((item) => item.id === categoryId);

      if (!target) {
        return;
      }

      await db.categories.put({
        ...target,
        enabled: !target.enabled
      });

      await this.loadReferenceData();
    },

    async createAssetSnapshot(note?: string) {
      let totalAsset = 0;
      let totalLiability = 0;

      for (const item of this.accounts) {
        if (item.kind === 'asset') {
          totalAsset += item.balance;
        } else {
          totalLiability += item.balance;
        }
      }

      const snapshot: AssetSnapshotRecord = {
        id: createId('snapshot'),
        snapshotDate: new Date().toISOString(),
        totalAsset,
        totalLiability,
        netAsset: totalAsset - totalLiability,
        note: note?.trim() || '手动记录资产快照',
        createdAt: new Date().toISOString()
      };

      await db.assetSnapshots.add(snapshot);
      await this.loadReferenceData();
    }
  }
});
