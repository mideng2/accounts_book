import Dexie, { type Table } from 'dexie';

export interface TransactionRecord {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  accountId: string;
  categoryId: string;
  occurredAt: string;
  merchant?: string;
  note?: string;
  source: 'manual' | 'alipay_import' | 'cmb_import';
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRecord {
  id: string;
  name: string;
  kind: 'asset' | 'liability';
  platform: 'cash' | 'alipay' | 'cmb' | 'credit_card' | 'manual';
  balance: number;
  isManuallyMaintained: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  sort: number;
  enabled: boolean;
}

export interface AssetSnapshotRecord {
  id: string;
  snapshotDate: string;
  totalAsset: number;
  totalLiability: number;
  netAsset: number;
  note?: string;
  createdAt: string;
}

export interface ImportTaskRecord {
  id: string;
  channel: 'alipay' | 'cmb';
  fileName: string;
  fileHash?: string;
  status: 'draft' | 'parsed' | 'confirmed' | 'failed';
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
}

export interface ImportItemRecord {
  id: string;
  taskId: string;
  channel: 'alipay' | 'cmb';
  rawText: string;
  occurredAt?: string;
  amount?: number;
  direction?: 'expense' | 'income';
  merchant?: string;
  description?: string;
  sourceOrderId?: string;
  dedupeKey?: string;
  status: 'pending' | 'ready' | 'skipped' | 'imported';
  skipReason?: string;
}

class MoneyDatabase extends Dexie {
  transactions!: Table<TransactionRecord>;
  accounts!: Table<AccountRecord>;
  categories!: Table<CategoryRecord>;
  assetSnapshots!: Table<AssetSnapshotRecord>;
  importTasks!: Table<ImportTaskRecord>;
  importItems!: Table<ImportItemRecord>;

  constructor() {
    super('money-pwa-db');

    this.version(1).stores({
      transactions: 'id, type, accountId, categoryId, occurredAt, source, sourceId',
      accounts: 'id, kind, platform, sort',
      categories: 'id, type, sort, enabled',
      assetSnapshots: 'id, snapshotDate, createdAt',
      importTasks: 'id, channel, status, createdAt',
      importItems: 'id, taskId, channel, status, dedupeKey'
    });
  }
}

export const db = new MoneyDatabase();

