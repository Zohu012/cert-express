import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmailCampaignTable } from "@/components/email-campaign-table";
import { BulkExcludeDateRange } from "@/components/bulk-exclude-date-range";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchEligibleCompanies } from "@/lib/email-automation";

export const dynamic = "force-dynamic";

interface Company {
  id: string;
  companyName: string;
  documentNumber: string;
  documentType: string;
  email: string | null;
  emailStatus: string | null;
  serviceDate: string;
}

interface ByServiceDate {
  date: string; // YYYY-MM-DD
  count: number;
}

async function fetchCandidates(
  page: number
): Promise<{
  companies: Company[];
  total: number;
  totalPages: number;
  byServiceDate: ByServiceDate[];
}> {
  const perPage = 50;
  const candidates = await fetchEligibleCompanies({ orderBy: "newest" });

  const total = candidates.length;
  const paged = candidates.slice((page - 1) * perPage, page * perPage);

  // Aggregate the full eligible list by service date (calendar day, local time).
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const d = c.serviceDate instanceof Date ? c.serviceDate : new Date(c.serviceDate);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${dd}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const byServiceDate = Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    companies: paged.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      documentNumber: c.documentNumber,
      documentType: c.documentType,
      email: c.email,
      emailStatus: c.emailStatus,
      serviceDate:
        c.serviceDate instanceof Date
          ? c.serviceDate.toISOString()
          : String(c.serviceDate),
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    byServiceDate,
  };
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
  const { companies, total, totalPages, byServiceDate } = await fetchCandidates(page);

  function fmtDate(s: string) {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function buildUrl(newPage: number) {
    return `/admin/emails?page=${newPage}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Email Campaigns ({total.toLocaleString()})</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/emails/reminders"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Reminders
          </Link>
          <Link
            href="/admin/emails/automation"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Automation
          </Link>
          <Link
            href="/admin/emails/excluded"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Excluded
          </Link>
          <Link
            href="/admin/emails/unsubscribed"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Unsubscribed
          </Link>
          <Link
            href="/admin/emails/history"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            View History →
          </Link>
        </div>
      </div>

      {total > 0 && (
        <div className="mb-4">
          <BulkExcludeDateRange />
        </div>
      )}

      {byServiceDate.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Candidates by service date
            </span>
            <span className="text-xs text-gray-400">
              {byServiceDate.length} day{byServiceDate.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-2">Service date</th>
                  <th className="px-4 py-2 text-right">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byServiceDate.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="px-4 py-1.5 text-gray-700">{fmtDate(row.date)}</td>
                    <td className="px-4 py-1.5 text-right font-semibold text-gray-800">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
