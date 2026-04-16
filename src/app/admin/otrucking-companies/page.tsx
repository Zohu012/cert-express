export const dynamic = "force-dynamic";

import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { OtruckingCompanyTable } from "@/components/otrucking-company-table";
import { ScrapeTriggerButton } from "@/components/scrape-trigger-button";

async function fetchData(page: number, query: string, statusFilter: string) {
  // Server-side fetch to our own API — use absolute URL via headers
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (statusFilter) params.set("status", statusFilter);

  // Import prisma directly for server component
  const { prisma } = await import("@/lib/db");
  const { Prisma } = await import("@prisma/client");

  const perPage = 50;
  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { companyName: { contains: query } },
      { usdotNumber: { contains: query } },
      { email: { contains: query } },
    ];
  }
  if (statusFilter) {
    where.scrapeStatus = statusFilter;
  }

  const [companies, total] = await Promise.all([
    prisma.otruckingCompany.findMany({
      where: where as Prisma.OtruckingCompanyWhereInput,
      orderBy: { scrapedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.otruckingCompany.count({ where: where as Prisma.OtruckingCompanyWhereInput }),
  ]);

  return { companies, total, totalPages: Math.ceil(total / perPage) };
}

export default async function OtruckingCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const query = params.q || "";
  const statusFilter = params.status || "";

  const { companies, total, totalPages } = await fetchData(page, query, statusFilter);

  const hasFilters = query || statusFilter;

  function buildUrl(overrides: Record<string, string | number>) {
    const base: Record<string, string> = { page: String(page) };
    if (query) base.q = query;
    if (statusFilter) base.status = statusFilter;
    const merged = { ...base, ...overrides };
    return (
      "/admin/otrucking-companies?" +
      Object.entries(merged)
        .filter(([, v]) => String(v) !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Otrucking Companies ({total.toLocaleString()})</h1>
        <ScrapeTriggerButton />
      </div>

      <Card className="mb-4">
        <form action="/admin/otrucking-companies" method="GET" className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name, DOT#, or email"
            className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="not_found">Not Found</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Filter
          </button>
          {hasFilters && (
            <a
              href="/admin/otrucking-companies"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </a>
          )}
        </form>
      </Card>

      <OtruckingCompanyTable companies={JSON.parse(JSON.stringify(companies))} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a href={buildUrl({ page: page - 1 })} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              Prev
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
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
