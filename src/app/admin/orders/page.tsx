import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { OrderTable } from "@/components/order-table";
import type { Prisma } from "@prisma/client";
import { OrderRateChart, type DailyOrderStat } from "@/components/order-rate-chart";

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const query = params.q || "";
  const statusFilter = params.status || "";
  const methodFilter = params.method || "";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";
  const perPage = 50;

  // Build where clause
  const where: Prisma.OrderWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (methodFilter) where.paymentMethod = methodFilter;
  if (query) {
    where.OR = [
      { customerEmail: { contains: query } },
      { paymentId: { contains: query } },
      { company: { companyName: { contains: query } } },
      { company: { usdotNumber: { contains: query } } },
    ];
  }
  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) createdAt.lt = endOfDay(dateTo);
    where.createdAt = createdAt;
  }

  const [orders, total, stats] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            usdotNumber: true,
            documentNumber: true,
            serviceDate: true,
            pdfFilename: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.order.count({ where }),
    // Summary stats (always from all orders)
    Promise.all([
      prisma.order.count({ where: { status: "completed" } }),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { status: "failed" } }),
      prisma.order.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
      }),
    ]),
  ]);

  const [completed, pending, failed, revenueAgg] = stats;
  const revenue = (revenueAgg._sum.amount || 0) / 100;
  const totalPages = Math.ceil(total / perPage);

  // ── Look up the latest email sent per USDOT # for the orders in view ──
  const usdotNumbers = Array.from(
    new Set(orders.map((o) => o.company.usdotNumber))
  );
  const emailLogsForUsdots = usdotNumbers.length
    ? await prisma.emailLog.findMany({
        where: {
          company: { usdotNumber: { in: usdotNumbers } },
        },
        select: {
          sentAt: true,
          company: { select: { usdotNumber: true } },
        },
        orderBy: { sentAt: "desc" },
      })
    : [];

  const latestEmailByUsdot = new Map<string, Date>();
  for (const log of emailLogsForUsdots) {
    const key = log.company.usdotNumber;
    if (!latestEmailByUsdot.has(key)) {
      latestEmailByUsdot.set(key, log.sentAt);
    }
  }

  const ordersWithEmail = orders.map((o) => ({
    ...o,
    emailSentAt: latestEmailByUsdot.get(o.company.usdotNumber) ?? null,
  }));

  // ── Per-day order/revenue stats for trailing 30 days ──
  const dailyStats: DailyOrderStat[] = await (async () => {
    const DAYS = 30;
    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const start = new Date(todayMidnight);
    start.setDate(start.getDate() - (DAYS - 1));
    const end = new Date(todayMidnight);
    end.setDate(end.getDate() + 1);

    const keys: string[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      keys.push(`${y}-${m}-${dd}`);
    }

    function dayKey(d: Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    const rows = await prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, amount: true, status: true },
    });

    const orderCount = new Map<string, number>();
    const revenueByDay = new Map<string, number>();
    for (const k of keys) {
      orderCount.set(k, 0);
      revenueByDay.set(k, 0);
    }
    for (const r of rows) {
      const k = dayKey(r.createdAt);
      if (!orderCount.has(k)) continue;
      orderCount.set(k, (orderCount.get(k) ?? 0) + 1);
      if (r.status === "completed") {
        revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + r.amount);
      }
    }

    return keys.map((k) => ({
      date: k,
      orders: orderCount.get(k) ?? 0,
      revenueCents: revenueByDay.get(k) ?? 0,
    }));
  })();

  function buildQuery(overrides: Record<string, string | number>) {
    const base: Record<string, string> = {};
    if (query) base.q = query;
    if (statusFilter) base.status = statusFilter;
    if (methodFilter) base.method = methodFilter;
    if (dateFrom) base.dateFrom = dateFrom;
    if (dateTo) base.dateTo = dateTo;
    const merged = { ...base, ...overrides };
    return (
      "?" +
      Object.entries(merged)
        .filter(([, v]) => v !== "" && v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  const hasFilters =
    query || statusFilter || methodFilter || dateFrom || dateTo;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Order History</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Completed Sales" value={completed} color="green" />
        <StatCard label="Pending" value={pending} color="yellow" />
        <StatCard label="Failed" value={failed} color="red" />
        <StatCard
          label="Total Revenue"
          value={`$${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          color="blue"
          isText
        />
      </div>

      {/* Orders trend chart */}
      <OrderRateChart data={dailyStats} />

      {/* Filters */}
      <Card className="mb-4">
        <form
          action="/admin/orders"
          method="GET"
          className="flex flex-wrap gap-3 items-center"
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search email, company, payment ID…"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            name="method"
            defaultValue={methodFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Methods</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Filter
          </button>
          {hasFilters && (
            <a
              href="/admin/orders"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </a>
          )}
        </form>
      </Card>

      {/* Count */}
      <p className="text-sm text-gray-500 mb-3">
        Showing {orders.length} of {total} order{total !== 1 ? "s" : ""}
        {statusFilter && ` · status: ${statusFilter}`}
        {methodFilter && ` · method: ${methodFilter}`}
        {(dateFrom || dateTo) &&
          ` · ${dateFrom || "start"} → ${dateTo || "today"}`}
        {query && ` · "${query}"`}
      </p>

      <OrderTable orders={ordersWithEmail} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a
              href={`/admin/orders${buildQuery({ page: page - 1 })}`}
              className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
            >
              ← Prev
            </a>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={`/admin/orders${buildQuery({ page: p })}`}
                className={`px-3 py-1 rounded text-sm ${
                  p === page
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {p}
              </a>
            );
          })}
          {page < totalPages && (
            <a
              href={`/admin/orders${buildQuery({ page: page + 1 })}`}
              className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "green" | "yellow" | "red" | "blue";
  isText?: boolean;
}) {
  const colorMap = {
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
    blue: "text-blue-700",
  };
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
    </Card>
  );
}
