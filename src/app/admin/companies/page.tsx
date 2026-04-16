// Force dynamic rendering — never cache this page
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CompanyTable } from "@/components/company-table";
import { MigrateEmailsButton } from "@/components/migrate-emails-button";
import type { Prisma } from "@prisma/client";

const SORTABLE_COLS = [
  "companyName", "usdotNumber", "documentNumber",
  "documentType", "serviceDate", "city", "email", "createdAt",
] as const;
type SortCol = typeof SORTABLE_COLS[number];

function toSortCol(s: string | undefined): SortCol {
  return (SORTABLE_COLS as readonly string[]).includes(s ?? "")
    ? (s as SortCol)
    : "createdAt";
}

// Explicit orderBy map — avoids computed-key issues with Prisma types
function makeOrderBy(
  col: SortCol,
  dir: "asc" | "desc"
): Prisma.CompanyOrderByWithRelationInput {
  const map: Record<SortCol, Prisma.CompanyOrderByWithRelationInput> = {
    companyName:    { companyName:    dir },
    usdotNumber:    { usdotNumber:    dir },
    documentNumber: { documentNumber: dir },
    documentType:   { documentType:   dir },
    serviceDate:    { serviceDate:    dir },
    city:           { city:           dir },
    email:          { email:          dir },
    createdAt:      { createdAt:      dir },
  };
  return map[col];
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; q?: string; date?: string;
    sort?: string; dir?: string; email?: string;
  }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params     = await searchParams;
  const page       = Math.max(1, parseInt(params.page || "1"));
  const query      = params.q       || "";
  const dateFilter = params.date    || "";
  const emailFilter = params.email  || "";   // "empty" | "filled" | ""
  const sortBy     = toSortCol(params.sort);
  const sortDir    = params.dir === "asc" ? "asc" : "desc";
  const perPage    = 50;

  // Build where clause
  const where: Prisma.CompanyWhereInput = {};
  if (query) {
    where.OR = [
      { companyName:    { contains: query } },
      { usdotNumber:    { contains: query } },
      { documentNumber: { contains: query } },
    ];
  }
  if (dateFilter) {
    where.serviceDate = new Date(dateFilter);
  }
  if (emailFilter === "empty") {
    where.email = null;
  } else if (emailFilter === "filled") {
    where.email = { not: null };
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: makeOrderBy(sortBy, sortDir),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);

  // Fetch scraped emails for these companies from OtruckingCompany
  const dotNumbers = [...new Set(companies.map((c) => c.usdotNumber))];
  const otruckingEmails = dotNumbers.length > 0
    ? await prisma.otruckingCompany.findMany({
        where: { usdotNumber: { in: dotNumbers }, email: { not: null } },
        select: { usdotNumber: true, email: true },
      })
    : [];
  const scrapedEmailMap: Record<string, string> = {};
  for (const oe of otruckingEmails) {
    if (oe.email) scrapedEmailMap[oe.usdotNumber] = oe.email;
  }

  const totalPages = Math.ceil(total / perPage);

  // Build URL preserving all active params
  function buildUrl(overrides: Record<string, string | number>) {
    const base: Record<string, string> = {
      sort: sortBy,
      dir:  sortDir,
      page: String(page),
    };
    if (query)       base.q     = query;
    if (dateFilter)  base.date  = dateFilter;
    if (emailFilter) base.email = emailFilter;
    const merged = { ...base, ...overrides };
    return (
      "/admin/companies?" +
      Object.entries(merged)
        .filter(([, v]) => String(v) !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  const hasFilters = query || dateFilter || emailFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies ({total.toLocaleString()})</h1>
        <MigrateEmailsButton />
      </div>

      <Card className="mb-4">
        <form action="/admin/companies" method="GET" className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name, DOT#, or MC#"
            className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {/* Email filter */}
          <select
            name="email"
            defaultValue={emailFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Emails</option>
            <option value="empty">No Email</option>
            <option value="filled">Has Email</option>
          </select>
          {/* Preserve sort through filter submissions */}
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
              href={`/admin/companies?sort=${sortBy}&dir=${sortDir}`}
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
            {emailFilter === "empty" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
                No Email
                <a href={buildUrl({ email: "", page: 1 })} className="ml-1 hover:text-orange-600">✕</a>
              </span>
            )}
            {emailFilter === "filled" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                Has Email
                <a href={buildUrl({ email: "", page: 1 })} className="ml-1 hover:text-green-600">✕</a>
              </span>
            )}
            {dateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                Date: <strong>{dateFilter}</strong>
                <a href={buildUrl({ date: "", page: 1 })} className="ml-1 hover:text-purple-600">✕</a>
              </span>
            )}
          </div>
        )}
      </Card>

      <CompanyTable
        companies={companies}
        sortBy={sortBy}
        sortDir={sortDir}
        query={query}
        dateFilter={dateFilter}
        emailFilter={emailFilter}
        page={page}
        scrapedEmailMap={scrapedEmailMap}
      />

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
