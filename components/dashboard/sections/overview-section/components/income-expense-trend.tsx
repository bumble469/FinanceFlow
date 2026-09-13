import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import type { Income, Expense } from "@/lib/types";
import { formatCurrency } from "../lib/overview-utils";

export function IncomeExpenseTrend({ income, expenses, currency }: { income: Income[]; expenses: Expense[]; currency: string }) {
  const monthKey = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const map = new Map<string, { month: string; income: number; expense: number }>();

  income.forEach((i) => {
    const key = monthKey(i.receivedAt ?? i.createdAt);
    const row = map.get(key) ?? { month: key, income: 0, expense: 0 };
    row.income += i.receivedAmount;
    map.set(key, row);
  });
  expenses.forEach((e) => {
    const key = monthKey(e.occurredAt ?? e.createdAt);
    const row = map.get(key) ?? { month: key, income: 0, expense: 0 };
    row.expense += e.paidAmount;
    map.set(key, row);
  });

  const data = Array.from(map.values()).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  const totalIncome = income.reduce((s, i) => s + (i.receivedAmount || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + (e.paidAmount || 0), 0);
  const net = totalIncome - totalExpense;

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground text-center">
          Not enough data yet for a trend — needs activity across at least 2 months.
        </p>
        {(totalIncome > 0 || totalExpense > 0) && (
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-muted-foreground">
              Income so far: <span className="font-semibold text-success">{formatCurrency(totalIncome, currency)}</span>
            </span>
            <span className="text-muted-foreground">
              Expenses so far: <span className="font-semibold text-destructive">{formatCurrency(totalExpense, currency)}</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
          <span className="text-muted-foreground">Income</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalIncome, currency)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
          <span className="text-muted-foreground">Expense</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalExpense, currency)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Net</span>
          <span className={`font-semibold ${net >= 0 ? "text-success" : "text-destructive"}`}>
            {net >= 0 ? "+" : ""}{formatCurrency(net, currency)}
          </span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} width={70} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => formatCurrency(v, currency)}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" name="Income" />
          <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="Expense" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}