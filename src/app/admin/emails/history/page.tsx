export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

// ─── Sortable columns ────────────────────────────────────────────────────────
const SORTABLE_COLS = [
  "sentAt", "toEmail", "subject", "clickCount", "lastClickAt",
  "openCount", "firstOpenAt",
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
    sentAt:      { sentAt:      dir },
    toEmail:     { toEmail:     dir },
    subject:     { subject:     dir },
    clickCount:  { clickCount:  dir },
    lastClickAt: { lastClickAt: dir },
    openCount:   { openCount:   dir },
    firstOpenAt: { firstOpenAt: dir },
  };
  return map[col];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function EmailHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; q?: string; date?: string;
    sort?: string; dir?: string; clicks?: string; opened?: string;
  }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params        = await searchParams;
  const page          = Math.max(1, parseInt(params.page || "1"));
  const query         = params.q      || "";
  const dateFilter    = params.date   || "";
  const clickFilter   = params.clicks || ""; // "yes" | "no" | ""
  const openedFilter  = params.opened || ""; // "yes" | "no" | ""
  const sortBy        = toSortCol(params.sort);
  const sortDir       = params.dir === "asc" ? "asc" : "desc";
  const perPage       = 50;

  // Build where clause
  const where: Prisma.EmailLogWhereInput = {};
  if (query) {
    where.OR = [
      { toEmail:           { contains: query } },
      { subject:           { contains: query } },
      { company: { companyName:  { contains: query } } },
      { company: { usdotNumber:  { contains: query } } },
    ];
  }
  if (dateFilter) {
    const d = new Date(dateFilter);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    where.sentAt = { gte: d, lt: nextDay };
  }
  if (clickFilter === "yes") {
    where.clickCount = { gt: 0 };
  } else if (clickFilter === "no") {
    where.clickCount = 0;
  }
  if (openedFilter === "yes") {
    where.openCount = { gt: 0 };
  } else if (openedFilter === "no") {
    where.openCount = 0;
  }

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

  // Total click + open stats
  const [totalClicks, clickedCount, openedCount] = await Promise.all([
    prisma.emailLog.aggregate({ _sum: { clickCount: true } }),
    prisma.emailLog.count({ where: { clickCount: { gt: 0 } } }),
    prisma.emailLog.count({ where: { openCount: { gt: 0 } } }),
  ]);

  function buildUrl(overrides: Record<string, string | number>) {
    const base: Record<string, string> = {
      sort: sortBy, dir: sortDir, page: String(page),
    };
    if (query)        base.q      = query;
    if (dateFilter)   base.date   = dateFilter;
    if (clickFilter)  base.clicks = clickFilter;
    if (openedFilter) base.opened = openedFilter;
    const merged = { ...base, ...overrides };
    return (
      "/admin/emails/history?" +
      Object.entries(merged)
        .filter(([, v]) => String(v) !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  function SortHeader({
    col, label,
  }: {
    col: SortCol; label: string;
  }) {
    const isActive = sortBy === col;
    const nextDir  = isActive && sortDir === "desc" ? "asc" : "desc";
    const href     = buildUrl({ sort: col, dir: nextDir, page: 1 });
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
        <Link href={href} className="flex items-center gap-1 hover:text-gray-800">
          {label}
          {isActive ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
        </Link>
      </th>
    );
  }

  const hasFilters = query || dateFilter || clickFilter || openedFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Email Offer History ({total.toLocaleString()})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Opened: <strong>{openedCount}</strong>
            {" · "}Total clicks: <strong>{totalClicks._sum.clickCount ?? 0}</strong>
            {" · "}Emails with ≥1 click: <strong>{clickedCount}</strong>
          </p>
        </div>
        <Link
          href="/admin/emails"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Send Emails
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <form
          action="/admin/emails/history"
          method="GET"
          className="flex gap-3 flex-wrap"
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by email, company, USDOT, or subject"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
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
            {dateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                Date: <strong>{dateFilter}</strong>
                <a href={buildUrl({ date: "", page: 1 })} className="ml-1 hover:text-purple-600">✕</a>
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader col="sentAt"      label="Sent At" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">US DOT #</th>
              <SortHeader col="toEmail"     label="Email" />
              <SortHeader col="subject"     label="Subject" />
              <SortHeader col="openCount"   label="Opened" />
              <SortHeader col="clickCount"  label="Clicks" />
              <SortHeader col="lastClickAt" label="Last Click" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
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
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {sentDate.toLocaleDateString("en-US")}{" "}
                    <span className="text-gray-400 text-xs">
                      {sentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[160px] truncate">
                    {log.company.companyName}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {log.company.usdotNumber}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">
                    {log.toEmail}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {firstOpen ? (
                      <span className="inline-flex flex-col items-start gap-0.5">
                        <span className="inline-flex items-center gap-1 text-teal-700 font-semibold text-xs">
                          ✓ Opened
                        </span>
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
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        log.clickCount > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {log.clickCount}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                    {lastClick
                      ? `${lastClick.toLocaleDateString("en-US")} ${lastClick.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
              <a
                key={p}
                href={buildUrl({ page: p })}
                className={`px-3 py-1 rounded text-sm ${
                  p === page ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
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
