import {
  db,
  type AccountRecord,
  type AssetSnapshotRecord,
  type CategoryRecord,
  type ImportItemRecord,
  type ImportTaskRecord,
  type TransactionRecord
} from '@/db/schema';

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  app: 'money-pwa';
  data: {
    transactions: TransactionRecord[];
    accounts: AccountRecord[];
    categories: CategoryRecord[];
    assetSnapshots: AssetSnapshotRecord[];
    importTasks: ImportTaskRecord[];
    importItems: ImportItemRecord[];
  };
}

function buildBackupFileName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `money-pwa-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`;
}

export async function createBackupPayload(): Promise<BackupPayload> {
  const [transactions, accounts, categories, assetSnapshots, importTasks, importItems] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.assetSnapshots.toArray(),
    db.importTasks.toArray(),
    db.importItems.toArray()
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'money-pwa',
    data: {
      transactions,
      accounts,
      categories,
      assetSnapshots,
      importTasks,
      importItems
    }
  };
}

export async function downloadBackupFile() {
  const payload = await createBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = buildBackupFileName();
  anchor.click();

  URL.revokeObjectURL(url);

  return payload;
}

export async function parseBackupFile(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;

  if (parsed.app !== 'money-pwa' || parsed.version !== 1) {
    throw new Error('备份文件版本不受支持。');
  }

  return parsed;
}

export async function restoreBackupPayload(payload: BackupPayload) {
  await db.transaction(
    'rw',
    [db.transactions, db.accounts, db.categories, db.assetSnapshots, db.importTasks, db.importItems],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.categories.clear(),
        db.assetSnapshots.clear(),
        db.importTasks.clear(),
        db.importItems.clear()
      ]);

      await Promise.all([
        payload.data.transactions.length ? db.transactions.bulkAdd(payload.data.transactions) : Promise.resolve(),
        payload.data.accounts.length ? db.accounts.bulkAdd(payload.data.accounts) : Promise.resolve(),
        payload.data.categories.length ? db.categories.bulkAdd(payload.data.categories) : Promise.resolve(),
        payload.data.assetSnapshots.length ? db.assetSnapshots.bulkAdd(payload.data.assetSnapshots) : Promise.resolve(),
        payload.data.importTasks.length ? db.importTasks.bulkAdd(payload.data.importTasks) : Promise.resolve(),
        payload.data.importItems.length ? db.importItems.bulkAdd(payload.data.importItems) : Promise.resolve()
      ]);
    }
  );
}
