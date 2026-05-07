import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ReminderCampaignTable } from "@/components/reminder-campaign-table";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchReminderCandidates } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const adminId = await verifySession();
  if (!adminId) redirect("/admin/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const perPage = 50;

  const candidates = await fetchReminderCandidates();
  const total = candidates.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const paged = candidates.slice((page - 1) * perPage, page * perPage);

  const rows = paged.map((c) => ({
    id: c.company.id,
    companyName: c.company.companyName,
    usdotNumber: c.company.usdotNumber,
    documentNumber: c.company.documentNumber,
    documentType: c.company.documentType,
    serviceDate:
      c.company.serviceDate instanceof Date
        ? c.company.serviceDate.toISOString()
        : String(c.company.serviceDate),
    email: c.company.email,
    totalClicks: c.totalClicks,
    lastClickAt: c.lastClickAt ? c.lastClickAt.toISOString() : null,
    lastSentAt: c.lastSentAt.toISOString(),
  }));

  function buildUrl(newPage: number) {
    return `/admin/emails/reminders?page=${newPage}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">2nd Reminders ({total.toLocaleString()})</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/emails"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            ← Campaigns
          </Link>
          <Link
            href="/admin/emails/history"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            History →
          </Link>
        </div>
      </div>

      <Card>
        <p className="text-sm text-gray-500 mb-4">
          Companies whose <strong>service date is today</strong>, who clicked their
          1st reminder, and haven&apos;t received a 2nd reminder yet. Sorted by total
          clicks (highest intent first).
        </p>

        {rows.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No reminder candidates right now. Check back after today&apos;s 1st-reminder
            batch has had time to be opened/clicked.
          </p>
        ) : (
          <ReminderCampaignTable rows={rows} />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {page > 1 && (
            <a
              href={buildUrl(page - 1)}
              className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
            >
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
            <a
              href={buildUrl(page + 1)}
              className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
