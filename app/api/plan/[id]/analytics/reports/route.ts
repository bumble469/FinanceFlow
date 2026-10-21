import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { computeFinanceTotals } from "@/lib/analytics/finance";
import {
  computeTicketSales,
  computeCheckIn,
  computeStallPerformance,
} from "@/lib/analytics/attendance";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function isDone(status: string): boolean {
  return status === "DONE" || status === "COMPLETED";
}

/**
 * Report data for the Overview "Reports" tab.
 *
 * Each report id maps to a table shape the client can turn into a CSV or a
 * print view. The shape is stable: `{ headers: string[], rows: (string|number)[][] }`.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [
      workItem,
      departments,
      expenses,
      income,
      tasks,
      milestones,
      members,
      hardwareItems,
      ticketTypes,
      bookings,
      attendees,
      stalls,
    ] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { id: true, name: true, type: true, budget: true, currency: true, financeEnabled: true },
      }),
      prisma.department.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true, budget: true },
      }),
      prisma.expense.findMany({
        where: { workItemId: planId },
        select: {
          id: true, amount: true, paidAmount: true, category: true, status: true,
          occurredAt: true, departmentId: true, stallId: true,
          department: { select: { name: true } },
        },
      }),
      prisma.income.findMany({
        where: { workItemId: planId },
        select: {
          id: true, amount: true, receivedAmount: true, type: true, status: true,
          receivedAt: true, departmentId: true, stallId: true,
          department: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: { workItemId: planId },
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true, completedAt: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      }),
      prisma.milestone.findMany({
        where: { workItemId: planId },
        select: { id: true, title: true, status: true, dueDate: true, originalDueDate: true },
      }),
      prisma.workItemMember.findMany({
        where: { workItemId: planId },
        select: {
          id: true, role: true, monthlyCost: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.hardwareItem.findMany({
        where: { workItemId: planId },
        select: {
          id: true, name: true, category: true, source: true, quantity: true,
          monthlyRentAmount: true, depositAmount: true, depositReturned: true, condition: true,
          department: { select: { name: true } },
        },
      }),
      prisma.ticketType.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true, price: true, capacity: true, isActive: true },
      }),
      prisma.ticketBooking.findMany({
        where: { workItemId: planId },
        select: {
          id: true, ticketTypeId: true, bookedByName: true, quantity: true, totalAmount: true,
          status: true, paymentStatus: true, createdAt: true,
        },
      }),
      prisma.ticketAttendee.findMany({
        where: { booking: { workItemId: planId } },
        select: { id: true, name: true, email: true, checkedIn: true, checkedInAt: true },
      }),
      prisma.stall.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const currency = workItem.currency || "USD";
    const now = new Date();
    const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

    // ── Report 1: Executive Financial Statement ────────────────────────────
    const incomeLikes = income.map((i) => ({
      id: i.id, amount: num(i.amount), receivedAmount: num(i.receivedAmount),
      type: i.type, status: i.status, departmentId: i.departmentId, stallId: i.stallId,
    }));
    const expenseLikes = expenses.map((e) => ({
      id: e.id, amount: num(e.amount), paidAmount: num(e.paidAmount),
      category: e.category, status: e.status,
      departmentId: e.departmentId, stallId: e.stallId,
    }));

    const totals = computeFinanceTotals({
      totalBudget: num(workItem.budget),
      departments: departments.map((d) => ({ ...d, budget: num(d.budget) })),
      income: incomeLikes,
      expenses: expenseLikes,
    });

    const deptSpend = new Map<string, number>();
    for (const e of expenses) {
      if (e.departmentId && ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(e.status)) {
        deptSpend.set(e.departmentId, (deptSpend.get(e.departmentId) ?? 0) + num(e.paidAmount));
      }
    }

    const financialStatement = {
      headers: ["Department", "Allocated Budget", "Actual Spend", "Variance", "% Used", "Tasks Done", "Tasks Total"],
      rows: departments.map((d) => {
        const budget = num(d.budget);
        const actual = deptSpend.get(d.id) ?? 0;
        const deptTasks = tasks.filter((t) => t.departmentId === d.id);
        const done = deptTasks.filter((t) => isDone(t.status)).length;
        return [
          d.name,
          budget,
          actual,
          budget - actual,
          budget > 0 ? Math.round((actual / budget) * 100) : 0,
          done,
          deptTasks.length,
        ];
      }),
      summary: [
        { label: "Total Budget", value: totals.totalBudget },
        { label: "Total Allocated", value: totals.totalAllocated },
        { label: "Total Expenses Paid", value: totals.totalExpensesPaid },
        { label: "Income Received", value: totals.totalIncomeReceived },
        { label: "Remaining Budget", value: totals.remainingBudget },
      ],
    };

    // ── Report 2: Milestone & Delivery Status ─────────────────────────────
    // Delivery % needs the milestone→task relation, so it is fetched here
    // rather than in the main Promise.all.
    const milestoneTaskLinks = await prisma.milestone.findMany({
      where: { workItemId: planId },
      select: {
        id: true,
        tasks: { select: { task: { select: { status: true } } } },
      },
    });
    const milestoneDelivery = new Map(
      milestoneTaskLinks.map((m) => {
        const total = m.tasks.length;
        const done = m.tasks.filter((t) => isDone(t.task.status)).length;
        return [m.id, { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }];
      })
    );

    const milestoneReport = {
      headers: ["Milestone", "Status", "Original Due", "Current Due", "Days Overdue", "Delivery", "Slipped"],
      rows: milestones.map((m) => {
        const d = milestoneDelivery.get(m.id) ?? { total: 0, done: 0, pct: 0 };
        const overdueDays = m.dueDate && m.status !== "ACHIEVED"
          ? Math.max(0, Math.floor((now.getTime() - new Date(m.dueDate).getTime()) / 86_400_000))
          : 0;
        const slipped = !!(m.originalDueDate && m.dueDate && new Date(m.dueDate) > new Date(m.originalDueDate));
        return [
          m.title,
          m.status,
          isoDate(m.originalDueDate),
          isoDate(m.dueDate),
          overdueDays,
          `${d.done}/${d.total} (${d.pct}%)`,
          slipped ? "Yes" : "No",
        ];
      }),
    };

    // Blocked and open tasks, for the delivery digest.
    const blockedTasks = tasks.filter((t) => t.status === "BLOCKED");
    const openTasks = tasks.filter((t) => !isDone(t.status));

    // ── Report 3: Resource & Payroll Cost Audit ───────────────────────────
    const taskMemberLinks = await prisma.task.findMany({
      where: { workItemId: planId },
      select: { id: true, members: { select: { workItemMemberId: true } } },
    });
    const memberTaskCount = new Map<string, number>();
    for (const t of taskMemberLinks) {
      for (const tm of t.members) {
        memberTaskCount.set(tm.workItemMemberId, (memberTaskCount.get(tm.workItemMemberId) ?? 0) + 1);
      }
    }

    const resourceAudit = {
      headers: ["Member", "Email", "Role", "Monthly Cost", "Assigned Tasks", "Cost per Task"],
      rows: members.map((m) => {
        const count = memberTaskCount.get(m.id) ?? 0;
        const cost = num(m.monthlyCost);
        return [
          m.user.name || m.user.email,
          m.user.email,
          m.role,
          cost,
          count,
          count > 0 ? Math.round((cost / count) * 100) / 100 : 0,
        ];
      }),
    };

    // ── Report 4: Hardware & Equipment Manifest ───────────────────────────
    const equipmentManifest = {
      headers: ["Item", "Category", "Source", "Qty", "Monthly Rent", "Deposit", "Deposit Returned", "Condition", "Department"],
      rows: hardwareItems.map((h) => [
        h.name,
        h.category,
        h.source,
        h.quantity,
        num(h.monthlyRentAmount),
        num(h.depositAmount),
        h.depositReturned ? "Yes" : "No",
        h.condition ?? "",
        h.department?.name ?? "",
      ]),
    };

    // ── Report 5: Event Attendance & Box Office ───────────────────────────
    const ticketTypeLikes = ticketTypes.map((t) => ({
      id: t.id, name: t.name, price: num(t.price), capacity: t.capacity, isActive: t.isActive,
    }));
    const bookingLikes = bookings.map((b) => ({
      id: b.id, ticketTypeId: b.ticketTypeId, quantity: b.quantity,
      totalAmount: num(b.totalAmount), status: b.status, paymentStatus: b.paymentStatus,
      createdAt: b.createdAt.toISOString(),
    }));
    const attendeeLikes = attendees.map((a) => ({
      id: a.id, name: a.name, email: a.email, checkedIn: a.checkedIn,
      checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
    }));

    const ticketSales = computeTicketSales(ticketTypeLikes, bookingLikes);
    const checkIn = computeCheckIn(attendeeLikes);
    const stallPerformance = computeStallPerformance(
      stalls.map((s) => ({ id: s.id, name: s.name })),
      incomeLikes,
      expenseLikes
    );

    const attendanceReport = {
      headers: ["Attendee", "Email", "Checked In", "Checked In At"],
      rows: attendees.map((a) => [
        a.name,
        a.email ?? "",
        a.checkedIn ? "Yes" : "No",
        isoDate(a.checkedInAt),
      ]),
    };

    const boxOfficeReport = {
      headers: ["Stall", "Income", "Expenses", "Net"],
      rows: stallPerformance.map((s) => [s.name, s.income, s.expense, s.net]),
    };

    const rollup = {
      currency,
      planName: workItem.name,
      planType: workItem.type,
      financeEnabled: workItem.financeEnabled,
      reports: {
        "financial-statement": financialStatement,
        "task-milestone-digest": {
          ...milestoneReport,
          summary: [
            { label: "Total Tasks", value: tasks.length },
            { label: "Open Tasks", value: openTasks.length },
            { label: "Blocked Tasks", value: blockedTasks.length },
            { label: "Milestones Achieved", value: milestones.filter((m) => m.status === "ACHIEVED").length },
            { label: "Milestones Overdue", value: milestones.filter((m) => m.dueDate && m.status !== "ACHIEVED" && new Date(m.dueDate) < now).length },
          ],
        },
        "resource-cost-audit": resourceAudit,
        "equipment-manifest": equipmentManifest,
        "attendance-commerce": {
          headers: attendanceReport.headers,
          rows: attendanceReport.rows,
          boxOffice: boxOfficeReport,
          ticketSales: ticketSales.rows,
          checkIn,
        },
      },
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/reports]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
