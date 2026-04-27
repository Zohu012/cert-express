export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { DeleteEmailLogButton } from "@/components/delete-email-log-button";
import { EmailRateChart, type DailyStat } from "@/components/email-rate-chart";

// ─── Sortable columns ────────────────────────────────────────────────────────
const SORTABLE_COLS = [
  "sentAt", "serviceDate", "companyName", "usdotNumber", "toEmail",
  "clickCount", "lastClickAt", "openCount", "firstOpenAt", "orderDate",
] as const;
type SortCol = typeof SORTABLE_COLS[number];

function toSortCol(s: string | undefined): SortCol {
  return (SORTABLE_COLS as readonly string[]).includes(s ?? "")
    ? (s as SortCol)
    : "sentAt";
}

// orderDate is computed in JS (Prisma can't orderBy a relation aggregate),
// so it is intentionally absent from this map.
type PrismaSortCol = Exclude<SortCol, "orderDate">;

function makeOrderBy(
  col: PrismaSortCol,
  dir: "asc" | "desc"
): Prisma.EmailLogOrderByWithRelationInput {
  const map: Record<PrismaSortCol, Prisma.EmailLogOrderByWithRelationInput> = {
    sentAt:       { sentAt:      dir },
    serviceDate:  { company: { serviceDate: dir } },
    companyName:  { company: { companyName:  dir } },
    usdotNumber:  { company: { usdotNumber:  dir } },
    toEmail:      { toEmail:     dir },
    clickCount:   { clickCount:  dir },
    lastClickAt:  { lastClickAt: dir },
    openCount:    { openCount:   dir },
    firstOpenAt:  { firstOpenAt: dir },
  };
  return map[col];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d;
}

function pct(num: number, denom: number) {
  if (denom === 0) return "0.0";
  return ((num / denom) * 100).toFixed(1);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function EmailHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; q?: string;
    dateFrom?: string; dateTo?: string;
    sort?: string; dir?: string;
    clicks?: string; opened?: string;
  }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params       = await searchParams;
  const page         = Math.max(1, parseInt(params.page || "1"));
  const query        = params.q        || "";
  const dateFrom     = params.dateFrom || "";
  const dateTo       = params.dateTo   || "";
  const clickFilter  = params.clicks   || "";
  const openedFilter = params.opened   || "";
  const sortBy       = toSortCol(params.sort);
  const sortDir      = params.dir === "asc" ? "asc" : "desc";
  const perPage      = 50;

  // ── Build date range sentAt filter ─────────────────────────────────────────
  function makeSentAtFilter(): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    const f: Prisma.DateTimeFilter = {};
    if (dateFrom) f.gte = new Date(dateFrom);
    if (dateTo)   f.lt  = endOfDay(dateTo);
    return f;
  }

  // ── Where clause for the main paginated list ────────────────────────────────
  const where: Prisma.EmailLogWhereInput = {};
  if (query) {
    where.OR = [
      { toEmail:  { contains: query } },
      { company: { companyName: { contains: query } } },
      { company: { usdotNumber: { contains: query } } },
    ];
  }
  const sentAtFilter = makeSentAtFilter();
  if (sentAtFilter) where.sentAt = sentAtFilter;
  if (clickFilter  === "yes") where.clickCount = { gt: 0 };
  else if (clickFilter === "no") where.clickCount = 0;
  if (openedFilter === "yes") where.openCount = { gt: 0 };
  else if (openedFilter === "no") where.openCount = 0;

  // ── Stats — reflect ALL active filters (search, date range, click, opened).
  //    When no filters are applied, stats cover every row in EmailLog.
  //    Since these are live Prisma queries + force-dynamic rendering, deleting
  //    a row updates the stats on the next page load automatically.
  const statsWhere: Prisma.EmailLogWhereInput = where;

  const [statsSent, statsOpenedCount, statsClickedCount, emailedLogs] =
    await Promise.all([
      prisma.emailLog.count({ where: statsWhere }),
      prisma.emailLog.count({ where: { ...statsWhere, openCount:  { gt: 0 } } }),
      prisma.emailLog.count({ where: { ...statsWhere, clickCount: { gt: 0 } } }),
      prisma.emailLog.findMany({
        where: statsWhere,
        select: { companyId: true, sentAt: true },
      }),
    ]);

  // Build map: companyId → first email date in range
  const companyFirstEmail = new Map<string, Date>();
  for (const log of emailedLogs) {
    const existing = companyFirstEmail.get(log.companyId);
    if (!existing || log.sentAt < existing) {
      companyFirstEmail.set(log.companyId, log.sentAt);
    }
  }

  const companyIds = [...companyFirstEmail.keys()];
  const paidOrders = companyIds.length > 0
    ? await prisma.order.findMany({
        where: {
          companyId: { in: companyIds },
          status: "completed",
        },
        select: { companyId: true, amount: true, createdAt: true },
      })
    : [];

  // companyId → most recent completed order createdAt (for the Order Date column)
  const latestOrderByCompany = new Map<string, Date>();
  for (const o of paidOrders) {
    const existing = latestOrderByCompany.get(o.companyId);
    if (!existing || o.createdAt > existing) {
      latestOrderByCompany.set(o.companyId, o.createdAt);
    }
  }

  // ── Paginated logs ──────────────────────────────────────────────────────────
  // Sorting by orderDate is handled in JS because Prisma can't orderBy a
  // relation aggregate (MAX(orders.createdAt)). Other columns use Prisma orderBy.
  const logsInclude = {
    company: { select: { companyName: true, usdotNumber: true, serviceDate: true } },
  } as const;

  let logs: Prisma.EmailLogGetPayload<{ include: typeof logsInclude }>[];
  let total: number;
  if (sortBy === "orderDate") {
    const all = await prisma.emailLog.findMany({ where, include: logsInclude });
    // Nulls last in both directions: rows without a completed order sink to the
    // bottom regardless of asc/desc — operators usually want to see the rows
    // that DO have orders, ordered by recency.
    all.sort((a, b) => {
      const da = latestOrderByCompany.get(a.companyId);
      const db = latestOrderByCompany.get(b.companyId);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sortDir === "asc"
        ? da.getTime() - db.getTime()
        : db.getTime() - da.getTime();
    });
    total = all.length;
    logs = all.slice((page - 1) * perPage, page * perPage);
  } else {
    [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: makeOrderBy(sortBy, sortDir),
        skip: (page - 1) * perPage,
        take: perPage,
        include: logsInclude,
      }),
      prisma.emailLog.count({ where }),
    ]);
  }
  const totalPages = Math.ceil(total / perPage);

  // Only count orders placed after the first email to that company
  const attributed = paidOrders.filter((o) => {
    const first = companyFirstEmail.get(o.companyId);
    return first && o.createdAt >= first;
  });

  const conversions  = attributed.length;
  const revenueCents = attributed.reduce((s, o) => s + o.amount, 0);
  const revenueStr   = `$${(revenueCents / 100).toFixed(2)}`;
  const rpeStr       = statsSent > 0
    ? `$${(revenueCents / 100 / statsSent).toFixed(2)}`
    : "$0.00";

  // ── Per-day rates for last 30 days (used by the trend chart) ──────────────
  //    Independent of active filters — always reflects all-time data for the
  //    trailing 30-day window so the chart stays a stable trend view.
  const dailyStats: DailyStat[] = await (async () => {
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
    end.setDate(end.getDate() + 1); // exclusive upper bound = tomorrow 00:00

    // Build the 30-day keys up front so empty days still render
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

    const logsInRange = await prisma.emailLog.findMany({
      where: { sentAt: { gte: start, lt: end } },
      select: {
        sentAt: true,
        clickCount: true,
        companyId: true,
      },
    });

    // Per-day counters
    const sentBy = new Map<string, number>();
    const clickedBy = new Map<string, number>();
    for (const k of keys) {
      sentBy.set(k, 0);
      clickedBy.set(k, 0);
    }

    // firstEmail[companyId] within the 30-day window
    const firstEmail = new Map<string, Date>();
    for (const log of logsInRange) {
      const k = dayKey(log.sentAt);
      sentBy.set(k, (sentBy.get(k) ?? 0) + 1);
      if (log.clickCount > 0) {
        clickedBy.set(k, (clickedBy.get(k) ?? 0) + 1);
      }
      const prev = firstEmail.get(log.companyId);
      if (!prev || log.sentAt < prev) firstEmail.set(log.companyId, log.sentAt);
    }

    const ids = [...firstEmail.keys()];
    const orders = ids.length
      ? await prisma.order.findMany({
          where: { companyId: { in: ids }, status: "completed" },
          select: { companyId: true, createdAt: true },
        })
      : [];

    // Conversions attributed to day D = paid orders from companies whose
    // first email in the 30-day window was on day D (and order was on/after it)
    const convBy = new Map<string, number>();
    for (const k of keys) convBy.set(k, 0);
    for (const o of orders) {
      const first = firstEmail.get(o.companyId);
      if (!first) continue;
      if (o.createdAt < first) continue;
      const k = dayKey(first);
      if (!convBy.has(k)) continue;
      convBy.set(k, (convBy.get(k) ?? 0) + 1);
    }

    return keys.map((k) => ({
      date: k,
      sent: sentBy.get(k) ?? 0,
      clicked: clickedBy.get(k) ?? 0,
      conversions: convBy.get(k) ?? 0,
    }));
  })();

  const statsLabelParts: string[] = [];
  if (dateFrom || dateTo) {
    statsLabelParts.push(`${dateFrom || "start"} → ${dateTo || "today"}`);
  }
  if (query) statsLabelParts.push(`"${query}"`);
  if (clickFilter  === "yes") statsLabelParts.push("has clicks");
  if (clickFilter  === "no")  statsLabelParts.push("no clicks");
  if (openedFilter === "yes") statsLabelParts.push("opened");
  if (openedFilter === "no")  statsLabelParts.push("not opened");
  const statsLabel = statsLabelParts.length > 0
    ? statsLabelParts.join(" · ")
    : "All time";

  // ── URL builder ─────────────────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string | number>) {
    const base: Record<string, string> = {
      sort: sortBy, dir: sortDir, page: String(page),
    };
    if (query)        base.q        = query;
    if (dateFrom)     base.dateFrom = dateFrom;
    if (dateTo)       base.dateTo   = dateTo;
    if (clickFilter)  base.clicks   = clickFilter;
    if (openedFilter) base.opened   = openedFilter;
    const merged = { ...base, ...overrides };
    return (
      "/admin/emails/history?" +
      Object.entries(merged)
        .filter(([, v]) => String(v) !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  function buildExportUrl() {
    const params: Record<string, string> = { sort: sortBy, dir: sortDir };
    if (query)        params.q        = query;
    if (dateFrom)     params.dateFrom = dateFrom;
    if (dateTo)       params.dateTo   = dateTo;
    if (clickFilter)  params.clicks   = clickFilter;
    if (openedFilter) params.opened   = openedFilter;
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/api/admin/email-logs/export?${qs}`;
  }

  function SortHeader({ col, label }: { col: SortCol; label: string }) {
    const isActive = sortBy === col;
    const nextDir  = isActive && sortDir === "desc" ? "asc" : "desc";
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
        <Link href={buildUrl({ sort: col, dir: nextDir, page: 1 })}
          className="flex items-center gap-1 hover:text-gray-800">
          {label}
          {isActive ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
        </Link>
      </th>
    );
  }

  const hasFilters = query || dateFrom || dateTo || clickFilter || openedFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Email Offer History ({total.toLocaleString()})
        </h1>
        <Link href="/admin/emails" className="text-sm text-blue-600 hover:underline">
          ← Back to Send Emails
        </Link>
      </div>

      {/* ── Stats card ── */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Statistics
          </span>
          <span className="text-xs text-gray-400">{statsLabel}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-100">
          {[
            { label: "Emails Sent",        value: statsSent.toLocaleString() },
            { label: "Open Rate",          value: `${pct(statsOpenedCount,  statsSent)}%` },
            { label: "Click Rate",         value: `${pct(statsClickedCount, statsSent)}%` },
            { label: "Conversion Rate",    value: `${pct(conversions,       statsSent)}%` },
            { label: "Revenue",            value: revenueStr },
            { label: "Revenue per Email",  value: rpeStr },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rate trend chart ── */}
      <EmailRateChart data={dailyStats} />

      {/* ── Filters ── */}
      <Card className="mb-4">
        <form action="/admin/emails/history" method="GET" className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by email, company, or USDOT"
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
            name="clicks"
            defaultValue={clickFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Clicks</option>
            <option value="yes">Has Clicks</option>
            <option value="no">No Clicks</option>
          </select>
          <select
            name="opened"
            defaultValue={openedFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Opens</option>
            <option value="yes">Opened</option>
            <option value="no">Not Opened</option>
          </select>
          <input type="hidden" name="sort" value={sortBy} />
          <input type="hidden" name="dir"  value={sortDir} />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Filter
          </button>
          {hasFilters && (
            <a
              href={`/admin/emails/history?sort=${sortBy}&dir=${sortDir}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </a>
          )}
          <a
            href={buildExportUrl()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            Export CSV
          </a>
        </form>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {query && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                Search: <strong>{query}</strong>
                <a href={buildUrl({ q: "", page: 1 })} className="ml-1 hover:text-blue-600">✕</a>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                {dateFrom && dateTo
                  ? `${dateFrom} → ${dateTo}`
                  : dateFrom
                  ? `From ${dateFrom}`
                  : `To ${dateTo}`}
                <a href={buildUrl({ dateFrom: "", dateTo: "", page: 1 })} className="ml-1 hover:text-purple-600">✕</a>
              </span>
            )}
            {clickFilter === "yes" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                Has Clicks
                <a href={buildUrl({ clicks: "", page: 1 })} className="ml-1 hover:text-green-600">✕</a>
              </span>
            )}
            {clickFilter === "no" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
                No Clicks
                <a href={buildUrl({ clicks: "", page: 1 })} className="ml-1 hover:text-orange-600">✕</a>
              </span>
            )}
            {openedFilter === "yes" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs rounded-full">
                Opened
                <a href={buildUrl({ opened: "", page: 1 })} className="ml-1 hover:text-teal-600">✕</a>
              </span>
            )}
            {openedFilter === "no" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                Not Opened
                <a href={buildUrl({ opened: "", page: 1 })} className="ml-1 hover:text-red-600">✕</a>
              </span>
            )}
          </div>
        )}
      </Card>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader col="sentAt"      label="Sent At" />
              <SortHeader col="serviceDate" label="Doc Date" />
              <SortHeader col="companyName" label="Company" />
              <SortHeader col="usdotNumber" label="US DOT #" />
              <SortHeader col="toEmail"     label="Email" />
              <SortHeader col="openCount"   label="Opened" />
              <SortHeader col="clickCount"  label="Clicks" />
              <SortHeader col="lastClickAt" label="Last Click" />
              <SortHeader col="orderDate"   label="Order Date" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  No email logs found.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const sentDate  = new Date(log.sentAt);
              const docDate   = log.company.serviceDate ? new Date(log.company.serviceDate) : null;
              const lastClick = log.lastClickAt ? new Date(log.lastClickAt) : null;
              const firstOpen = log.firstOpenAt ? new Date(log.firstOpenAt) : null;
              const latestOrder = latestOrderByCompany.get(log.companyId) ?? null;
              return (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">
                    {sentDate.toLocaleDateString("en-US")}{" "}
                    <span className="text-gray-400">
                      {sentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                    {docDate ? docDate.toLocaleDateString("en-US") : "—"}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[150px] truncate">
                    {log.company.companyName}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {log.company.usdotNumber}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate text-xs">
                    {log.toEmail}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {firstOpen ? (
                      <span className="inline-flex flex-col items-start gap-0.5">
                        <span className="text-teal-700 font-semibold text-xs">✓ Opened</span>
                        <span className="text-gray-400 text-xs">
                          {firstOpen.toLocaleDateString("en-US")}{" "}
                          {firstOpen.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      log.clickCount > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                    }`}>
                      {log.clickCount}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                    {lastClick
                      ? `${lastClick.toLocaleDateString("en-US")} ${lastClick.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                    {latestOrder ? latestOrder.toLocaleDateString("en-US") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteEmailLogButton id={log.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a href={buildUrl({ page: page - 1 })} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              ← Prev
            </a>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <a key={p} href={buildUrl({ page: p })}
                className={`px-3 py-1 rounded text-sm ${p === page ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"}`}>
                {p}
              </a>
            );
          })}
          {page < totalPages && (
            <a href={buildUrl({ page: page + 1 })} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
