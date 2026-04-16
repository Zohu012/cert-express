export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { DeleteEmailLogButton } from "@/components/delete-email-log-button";

// ─── Sortable columns ────────────────────────────────────────────────────────
const SORTABLE_COLS = [
  "sentAt", "companyName", "usdotNumber", "toEmail", "subject",
  "clickCount", "lastClickAt", "openCount", "firstOpenAt",
] as const;
type SortCol = typeof SORTABLE_COLS[number];

function toSortCol(s: string | undefined): SortCol {
  return (SORTABLE_COLS as readonly string[]).includes(s ?? "")
    ? (s as SortCol)
    : "sentAt";
}

function makeOrderBy(
  col: SortCol,
  dir: "asc" | "desc"
): Prisma.EmailLogOrderByWithRelationInput {
  const map: Record<SortCol, Prisma.EmailLogOrderByWithRelationInput> = {
    sentAt:       { sentAt:      dir },
    companyName:  { company: { companyName:  dir } },
    usdotNumber:  { company: { usdotNumber:  dir } },
    toEmail:      { toEmail:     dir },
    subject:      { subject:     dir },
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
      { subject:  { contains: query } },
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

  // ── Paginated logs ──────────────────────────────────────────────────────────
  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: makeOrderBy(sortBy, sortDir),
      skip: (page - 1) * perPage,
      take: perPage,
      include: { company: { select: { companyName: true, usdotNumber: true } } },
    }),
    prisma.emailLog.count({ where }),
  ]);
  const totalPages = Math.ceil(total / perPage);

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

      {/* ── Filters ── */}
      <Card className="mb-4">
        <form action="/admin/emails/history" method="GET" className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by email, company, USDOT, or subject"
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
              <SortHeader col="companyName" label="Company" />
              <SortHeader col="usdotNumber" label="US DOT #" />
              <SortHeader col="toEmail"     label="Email" />
              <SortHeader col="subject"     label="Subject" />
              <SortHeader col="openCount"   label="Opened" />
              <SortHeader col="clickCount"  label="Clicks" />
              <SortHeader col="lastClickAt" label="Last Click" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No email logs found.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const sentDate  = new Date(log.sentAt);
              const lastClick = log.lastClickAt ? new Date(log.lastClickAt) : null;
              const firstOpen = log.firstOpenAt ? new Date(log.firstOpenAt) : null;
              return (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">
                    {sentDate.toLocaleDateString("en-US")}{" "}
                    <span className="text-gray-400">
                      {sentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
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
                  <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate text-xs" title={log.subject}>
                    {log.subject}
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
