import { describe, it, expect } from "vitest";

interface Contribution {
  contributionType: "monetary" | "in_kind";
  promisedAmount: number;
  amountReceived: number;
}

interface Expense {
  amount: number;
  receiptStatus: "pending" | "verified" | "rejected";
}

function calculateMetrics(contributions: Contribution[], expenses: Expense[], budget: number) {
  let totalPromisedMonetary = 0;
  let totalReceivedMonetary = 0;
  let inKindCount = 0;

  for (const c of contributions) {
    if (c.contributionType === "monetary") {
      totalPromisedMonetary += c.promisedAmount;
      totalReceivedMonetary += c.amountReceived;
    } else {
      inKindCount += 1;
    }
  }

  const outstandingCommitments = Math.max(0, totalPromisedMonetary - totalReceivedMonetary);

  let totalVerifiedExpenses = 0;
  let expensesAwaitingVerification = 0;

  for (const e of expenses) {
    if (e.receiptStatus === "verified") {
      totalVerifiedExpenses += e.amount;
    } else if (e.receiptStatus === "pending") {
      expensesAwaitingVerification += e.amount;
    }
  }

  const budgetUtilization = budget > 0 ? (totalVerifiedExpenses / budget) * 100 : 0;
  const cashBalance = totalReceivedMonetary - totalVerifiedExpenses;

  return {
    totalPromisedMonetary,
    totalReceivedMonetary,
    outstandingCommitments,
    totalVerifiedExpenses,
    expensesAwaitingVerification,
    inKindCount,
    budgetUtilization: Math.round(budgetUtilization * 10) / 10,
    cashBalance
  };
}

describe("SevaTrack AI Comprehensive Unit Tests (INR ₹)", () => {
  it("calculates monetary contribution totals and outstanding commitments with partial payments", () => {
    const contributions: Contribution[] = [
      { contributionType: "monetary", promisedAmount: 200000, amountReceived: 150000 },
      { contributionType: "monetary", promisedAmount: 50000, amountReceived: 50000 },
      { contributionType: "monetary", promisedAmount: 100000, amountReceived: 0 }
    ];
    const metrics = calculateMetrics(contributions, [], 500000);

    expect(metrics.totalPromisedMonetary).toBe(350000);
    expect(metrics.totalReceivedMonetary).toBe(200000);
    expect(metrics.outstandingCommitments).toBe(150000);
  });

  it("excludes in-kind contributions from monetary totals and tracks in-kind count", () => {
    const contributions: Contribution[] = [
      { contributionType: "monetary", promisedAmount: 100000, amountReceived: 100000 },
      { contributionType: "in_kind", promisedAmount: 0, amountReceived: 0 },
      { contributionType: "in_kind", promisedAmount: 0, amountReceived: 0 }
    ];
    const metrics = calculateMetrics(contributions, [], 500000);

    expect(metrics.totalPromisedMonetary).toBe(100000);
    expect(metrics.inKindCount).toBe(2);
  });

  it("separates verified expenses from pending expenses and calculates budget utilization", () => {
    const expenses: Expense[] = [
      { amount: 150000, receiptStatus: "verified" },
      { amount: 50000, receiptStatus: "pending" },
      { amount: 20000, receiptStatus: "rejected" }
    ];
    const metrics = calculateMetrics([], expenses, 500000);

    expect(metrics.totalVerifiedExpenses).toBe(150000);
    expect(metrics.expensesAwaitingVerification).toBe(50000);
    expect(metrics.budgetUtilization).toBe(30.0); // 150k / 500k = 30%
  });

  it("calculates cash balance accurately (received cash minus verified expenses)", () => {
    const contributions: Contribution[] = [
      { contributionType: "monetary", promisedAmount: 300000, amountReceived: 300000 }
    ];
    const expenses: Expense[] = [
      { amount: 120000, receiptStatus: "verified" },
      { amount: 50000, receiptStatus: "pending" }
    ];
    const metrics = calculateMetrics(contributions, expenses, 500000);

    expect(metrics.cashBalance).toBe(180000); // 300k - 120k verified (pending excluded from cash out)
  });
});
