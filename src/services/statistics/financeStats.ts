import { db } from '@/db/schema';

export interface CategoryDetailItem {
  id: string;
  occurredAt: string;
  merchant: string;
  note: string;
  amount: number;
}

export interface CategoryRankingItem {
  categoryId: string;
  name: string;
  icon: string;
  amount: number;
  share: number;
  details: CategoryDetailItem[];
}

export interface MonthBreakdownItem {
  monthKey: string;
  label: string;
  expense: number;
  rankings: CategoryRankingItem[];
}

export interface MonthlyBillSummaryItem {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export interface YearlyBillSummaryItem {
  year: number;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export interface StatsPageResult {
  monthBreakdowns: MonthBreakdownItem[];
  monthlyBills: MonthlyBillSummaryItem[];
  yearlyBills: YearlyBillSummaryItem[];
}

function toMonthKey(dateText: string) {
  return dateText.slice(0, 7);
}

function toMonthLabel(monthKey: string) {
  return `${monthKey.slice(0, 4)}-${monthKey.slice(5, 7)}`;
}

function toYear(dateText: string) {
  return Number(dateText.slice(0, 4));
}

export async function getStatsPageData(): Promise<StatsPageResult> {
  const [transactions, categories] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const monthIncomeExpenseMap = new Map<string, { income: number; expense: number }>();
  const monthCategoryDetailsMap = new Map<string, Map<string, CategoryDetailItem[]>>();
  const yearlyMap = new Map<number, { income: number; expense: number }>();

  for (const item of transactions) {
    const monthKey = toMonthKey(item.occurredAt);
    const year = toYear(item.occurredAt);
    const monthSummary = monthIncomeExpenseMap.get(monthKey) ?? { income: 0, expense: 0 };
    const yearlySummary = yearlyMap.get(year) ?? { income: 0, expense: 0 };

    if (item.type === 'income') {
      monthSummary.income += item.amount;
      yearlySummary.income += item.amount;
    } else {
      monthSummary.expense += item.amount;
      yearlySummary.expense += item.amount;

      const monthCategoryMap = monthCategoryDetailsMap.get(monthKey) ?? new Map<string, CategoryDetailItem[]>();
      const categoryDetails = monthCategoryMap.get(item.categoryId) ?? [];

      categoryDetails.push({
        id: item.id,
        occurredAt: item.occurredAt,
        merchant: item.merchant ?? '未填写商户',
        note: item.note ?? '',
        amount: item.amount
      });

      monthCategoryMap.set(item.categoryId, categoryDetails);
      monthCategoryDetailsMap.set(monthKey, monthCategoryMap);
    }

    monthIncomeExpenseMap.set(monthKey, monthSummary);
    yearlyMap.set(year, yearlySummary);
  }

  const monthBreakdowns = [...monthIncomeExpenseMap.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([monthKey, summary]) => {
      const categoryDetailMap = monthCategoryDetailsMap.get(monthKey) ?? new Map<string, CategoryDetailItem[]>();
      const rankings = [...categoryDetailMap.entries()]
        .map(([categoryId, details]) => {
          const amount = details.reduce((total, current) => total + current.amount, 0);
          const category = categoryMap.get(categoryId);

          return {
            categoryId,
            name: category?.name ?? '未分类',
            icon: category?.icon ?? '•',
            amount,
            share: summary.expense > 0 ? amount / summary.expense : 0,
            details: [...details].sort((a, b) => b.amount - a.amount || (a.occurredAt < b.occurredAt ? 1 : -1))
          };
        })
        .sort((a, b) => b.amount - a.amount);

      return {
        monthKey,
        label: toMonthLabel(monthKey),
        expense: summary.expense,
        rankings
      };
    });

  const monthlyBills = [...monthIncomeExpenseMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthKey, value]) => ({
      monthKey,
      label: toMonthLabel(monthKey),
      income: value.income,
      expense: value.expense,
      balance: value.income - value.expense
    }));

  const yearlyBills = [...yearlyMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, value]) => ({
      year,
      label: `${year}`,
      income: value.income,
      expense: value.expense,
      balance: value.income - value.expense
    }));

  return {
    monthBreakdowns,
    monthlyBills,
    yearlyBills
  };
}
