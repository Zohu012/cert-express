import Link from "next/link";
import { Card } from "@/components/ui/card";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ExcludedCompaniesTable } from "@/components/excluded-companies-table";

export const dynamic = "force-dynamic";

export default async function ExcludedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const perPage = 100;

  const [rows, total] = await Promise.all([
    prisma.excludedCompany.findMany({
      orderBy: { excludedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            email: true,
            usdotNumber: true,
            documentType: true,
            serviceDate: true,
          },
        },
      },
    }),
    prisma.excludedCompany.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const companies = rows.map((r) => ({
    id: r.company.id,
    companyName: r.company.companyName,
    email: r.company.email,
    usdotNumber: r.company.usdotNumber,
    documentType: r.company.documentType,
    serviceDate: r.company.serviceDate.toISOString(),
    excludedAt: r.excludedAt.toISOString(),
  }));

  function buildUrl(p: number) {
    return `/admin/emails/excluded?page=${p}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Excluded Companies ({total.toLocaleString()})</h1>
        <Link
          href="/admin/emails"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← Back to Campaigns
        </Link>
      </div>

      <Card>
        <p className="text-sm text-gray-500 mb-4">
          Companies excluded from manual and auto email sending. Restore them to return them to the active send queue.
        </p>
        {companies.length === 0 ? (
          <p className="text-gray-400 text-sm">No excluded companies.</p>
        ) : (
          <ExcludedCompaniesTable rows={companies} />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a href={buildUrl(page - 1)} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              ← Prev
            </a>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <a
                key={p}
                href={buildUrl(p)}
                className={`px-3 py-1 rounded text-sm ${
                  p === page ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {p}
              </a>
            );
          })}
          {page < totalPages && (
            <a href={buildUrl(page + 1)} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
