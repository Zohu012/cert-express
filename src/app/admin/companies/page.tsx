import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CompanyTable } from "@/components/company-table";

// Columns that can be sorted and their Prisma field names
const SORTABLE = ["companyName", "usdotNumber", "documentNumber", "documentType", "serviceDate", "city", "createdAt"] as const;
type SortField = typeof SORTABLE[number];

function isValidSort(s: string): s is SortField {
  return (SORTABLE as readonly string[]).includes(s);
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; date?: string; sort?: string; dir?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page      = Math.max(1, parseInt(params.page || "1"));
  const query     = params.q      || "";
  const dateFilter = params.date  || "";
  const sortBy    = isValidSort(params.sort || "") ? (params.sort as SortField) : "createdAt";
  const sortDir   = params.dir === "asc" ? "asc" : "desc";
  const perPage   = 50;

  const where: Record<string, unknown> = {};
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

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  // Build a URL preserving all active params, merging overrides
  function buildUrl(overrides: Record<string, string | number>) {
    const base: Record<string, string> = { page: String(page) };
    if (query)      base.q    = query;
    if (dateFilter) base.date = dateFilter;
    if (sortBy !== "createdAt") base.sort = sortBy;
    if (sortDir !== "desc")     base.dir  = sortDir;
    const merged = { ...base, ...overrides };
    return "/admin/companies?" + Object.entries(merged)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies ({total})</h1>
      </div>

      <Card className="mb-4">
        <form action="/admin/companies" method="GET" className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name, DOT#, or MC#"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {/* Carry sort state through filter submissions */}
          {sortBy !== "createdAt" && <input type="hidden" name="sort" value={sortBy} />}
          {sortDir !== "desc"     && <input type="hidden" name="dir"  value={sortDir} />}
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Filter
          </button>
          {(query || dateFilter) && (
            <a href="/admin/companies" className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Clear
            </a>
          )}
        </form>
      </Card>

      <CompanyTable
        companies={companies}
        sortBy={sortBy}
        sortDir={sortDir}
        query={query}
        dateFilter={dateFilter}
        page={page}
      />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a href={buildUrl({ page: page - 1 })} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">← Prev</a>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={buildUrl({ page: p })}
                className={`px-3 py-1 rounded text-sm ${p === page ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
              >
                {p}
              </a>
            );
          })}
          {page < totalPages && (
            <a href={buildUrl({ page: page + 1 })} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">Next →</a>
          )}
        </div>
      )}
    </div>
  );
}
