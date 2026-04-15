import { db, type AccountRecord, type AssetSnapshotRecord, type CategoryRecord } from '@/db/schema';

function nowIso() {
  return new Date().toISOString();
}

const seedAccounts: AccountRecord[] = [
  {
    id: 'account-alipay',
    name: '支付宝',
    kind: 'asset',
    platform: 'alipay',
    balance: 0,
    isManuallyMaintained: true,
    sort: 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'account-cmb',
    name: '招商银行',
    kind: 'asset',
    platform: 'cmb',
    balance: 0,
    isManuallyMaintained: true,
    sort: 2,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'account-cash',
    name: '现金',
    kind: 'asset',
    platform: 'cash',
    balance: 0,
    isManuallyMaintained: true,
    sort: 3,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'account-investment',
    name: '投资账户',
    kind: 'asset',
    platform: 'manual',
    balance: 0,
    isManuallyMaintained: true,
    sort: 4,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'account-credit-card',
    name: '信用卡负债',
    kind: 'liability',
    platform: 'credit_card',
    balance: 0,
    isManuallyMaintained: true,
    sort: 5,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

const seedCategories: CategoryRecord[] = [
  { id: 'cat-food', name: '餐饮', type: 'expense', icon: 'zhongcan', color: '#f4b400', sort: 1, enabled: true },
  { id: 'cat-transport', name: '交通', type: 'expense', icon: 'jiaotong', color: '#f7a541', sort: 2, enabled: true },
  { id: 'cat-shopping', name: '购物', type: 'expense', icon: 'gouwu', color: '#e67d73', sort: 3, enabled: true },
  { id: 'cat-grocery', name: '买菜', type: 'expense', icon: 'nangua', color: '#80b648', sort: 4, enabled: true },
  { id: 'cat-medical', name: '医疗', type: 'expense', icon: 'yiyuan', color: '#d46866', sort: 5, enabled: true },
  { id: 'cat-housing', name: '旅游', type: 'expense', icon: 'lvyoulvhang', color: '#9981ff', sort: 6, enabled: true },
  { id: 'cat-daily', name: '日用', type: 'expense', icon: 'weishengzhi', color: '#6ab0c9', sort: 7, enabled: true },
  { id: 'cat-insurance', name: '保险', type: 'expense', icon: 'baoxiandingdan', color: '#7b95c9', sort: 8, enabled: true },
  { id: 'cat-credit-repayment', name: '信用卡还款', type: 'expense', icon: 'xinyongqiahuankuan', color: '#8c6dd1', sort: 9, enabled: true },
  { id: 'cat-other-expense', name: '其他', type: 'expense', icon: 'qita', color: '#8e8a82', sort: 10, enabled: true },
  { id: 'cat-salary', name: '工资', type: 'income', icon: 'gongzi', color: '#49a56a', sort: 1, enabled: true },
  { id: 'cat-refund', name: '退款', type: 'income', icon: 'tuikuan', color: '#3e9c7a', sort: 2, enabled: true },
  { id: 'cat-housing-fund', name: '公积金', type: 'income', icon: 'gongjijin_huaban', color: '#58a589', sort: 3, enabled: true },
  { id: 'cat-alipay-finance', name: '支付宝理财', type: 'income', icon: 'zhifubao', color: '#4a90e2', sort: 4, enabled: true },
  { id: 'cat-cmb-finance', name: '招行理财', type: 'income', icon: 'zhaoxing', color: '#f4b400', sort: 5, enabled: true },
  { id: 'cat-hsbc-finance', name: '徽商理财', type: 'income', icon: 'huishangyinhang', color: '#f08b37', sort: 6, enabled: true },
  { id: 'cat-jd-finance', name: '京东金融理财', type: 'income', icon: 'licai', color: '#d94b43', sort: 7, enabled: true },
  { id: 'cat-other-income', name: '其他', type: 'income', icon: 'qita', color: '#4684dd', sort: 8, enabled: true }
];

const seedSnapshots: AssetSnapshotRecord[] = [];

async function syncCategories() {
  const existingCategories = await db.categories.toArray();
  const existingMap = new Map(existingCategories.map((item) => [item.id, item]));

  await db.transaction('rw', db.categories, async () => {
    for (const seedCategory of seedCategories) {
      const existing = existingMap.get(seedCategory.id);

      await db.categories.put({
        ...seedCategory,
        enabled: existing?.enabled ?? seedCategory.enabled
      });
    }
  });
}

export async function ensureSeedData() {
  const [accountCount, snapshotCount] = await Promise.all([
    db.accounts.count(),
    db.assetSnapshots.count()
  ]);

  await db.transaction('rw', db.accounts, db.assetSnapshots, async () => {
    if (accountCount === 0) {
      await db.accounts.bulkAdd(seedAccounts);
    }

    if (snapshotCount === 0) {
      await db.assetSnapshots.bulkAdd(seedSnapshots);
    }
  });

  await db.transaction('rw', db.assetSnapshots, async () => {
    await db.assetSnapshots
      .where('id')
      .equals('snapshot-2026-06')
      .delete();

    const snapshots = await db.assetSnapshots.toArray();
    const demoSnapshots = snapshots.filter((item) =>
      item.note === '初始演示快照' || item.snapshotDate.startsWith('2026-06')
    );

    if (demoSnapshots.length > 0) {
      await db.assetSnapshots.bulkDelete(demoSnapshots.map((item) => item.id));
    }
  });

  await syncCategories();
}
