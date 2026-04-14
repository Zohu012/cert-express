import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CompanyTable } from "@/components/company-table";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; date?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const query = params.q || "";
  const dateFilter = params.date || "";
  const perPage = 50;

  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { companyName: { contains: query } },
      { usdotNumber: { contains: query } },
      { documentNumber: { contains: query } },
    ];
  }
  if (dateFilter) {
    where.serviceDate = new Date(dateFilter);
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies ({total})</h1>
      </div>

      <Card className="mb-4">
        <form action="/admin/companies" method="GET" className="flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name, DOT#, or MC#"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Filter
          </button>
        </form>
      </Card>

      <CompanyTable companies={companies} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={`/admin/companies?page=${p}${query ? `&q=${query}` : ""}${dateFilter ? `&date=${dateFilter}` : ""}`}
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
        </div>
      )}
    </div>
  );
}
