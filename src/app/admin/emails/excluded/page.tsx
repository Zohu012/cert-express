import Link from "next/link";
import { Card } from "@/components/ui/card";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ExcludedCompaniesTable } from "@/components/excluded-companies-table";

export const dynamic = "force-dynamic";

export default async function ExcludedPage() {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const rows = await prisma.excludedCompany.findMany({
    orderBy: { excludedAt: "desc" },
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
  });

  const companies = rows.map((r) => ({
    id: r.company.id,
    companyName: r.company.companyName,
    email: r.company.email,
    usdotNumber: r.company.usdotNumber,
    documentType: r.company.documentType,
    serviceDate: r.company.serviceDate.toISOString(),
    excludedAt: r.excludedAt.toISOString(),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Excluded Companies ({companies.length.toLocaleString()})</h1>
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
    </div>
  );
}
