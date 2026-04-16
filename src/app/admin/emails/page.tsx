import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmailCampaignTable } from "@/components/email-campaign-table";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";

interface Company {
  id: string;
  companyName: string;
  documentNumber: string;
  documentType: string;
  email: string | null;
  emailStatus: string | null;
  serviceDate: string;
}

async function fetchCandidates(
  page: number
): Promise<{ companies: Company[]; total: number; totalPages: number }> {
  const params = new URLSearchParams({ page: String(page) });
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/admin/email-candidates?${params}`, {
    headers: { cookie: "" },
  });
  if (!res.ok) return { companies: [], total: 0, totalPages: 0 };
  return res.json();
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const { companies, total, totalPages } = await fetchCandidates(page);

  function buildUrl(newPage: number) {
    return `/admin/emails?page=${newPage}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Email Campaigns ({total.toLocaleString()})</h1>
        <Link
          href="/admin/emails/history"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          View History →
        </Link>
      </div>

      <Card>
        <p className="text-sm text-gray-500 mb-4">
          Companies with email addresses that haven&apos;t been contacted yet.
        </p>

        {companies.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No companies ready to email. Add email addresses in the Companies page first.
          </p>
        ) : (
          <EmailCampaignTable companies={companies} />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a href={buildUrl(page - 1)} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
              Prev
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
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
