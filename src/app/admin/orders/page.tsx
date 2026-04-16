import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { OrderTable } from "@/components/order-table";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    method?: string;
  }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const query = params.q || "";
  const statusFilter = params.status || "";
  const methodFilter = params.method || "";
  const perPage = 50;

  // Build where clause
  const where: Record<string, unknown> = {};
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

  function buildQuery(overrides: Record<string, string | number>) {
    const base: Record<string, string> = {};
    if (query) base.q = query;
    if (statusFilter) base.status = statusFilter;
    if (methodFilter) base.method = methodFilter;
    const merged = { ...base, ...overrides };
    return (
      "?" +
      Object.entries(merged)
        .filter(([, v]) => v !== "" && v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

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

      {/* Filters */}
      <Card className="mb-4">
        <form
          action="/admin/orders"
          method="GET"
          className="flex flex-wrap gap-3"
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search email, company, payment ID…"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
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
          {(query || statusFilter || methodFilter) && (
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
        {query && ` · "${query}"`}
      </p>

      <OrderTable orders={orders} />

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
  isText,
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
