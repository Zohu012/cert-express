import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmailCampaignTable } from "@/components/email-campaign-table";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

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

async function fetchCandidates(
  page: number
): Promise<{ companies: Company[]; total: number; totalPages: number }> {
  const perPage = 50;

  // Build set of (usdotNumber + email) pairs that have been SUCCESSFULLY contacted
  // (EmailLog row AND Company.emailStatus = "sent").
  const sentLogs = await prisma.emailLog.findMany({
    where: { company: { emailStatus: "sent" } },
    select: {
      toEmail: true,
      company: { select: { usdotNumber: true } },
    },
  });

  const contactedSet = new Set<string>();
  for (const log of sentLogs) {
    const dot = log.company?.usdotNumber;
    if (dot && log.toEmail) {
      contactedSet.add(`${dot}:${log.toEmail.toLowerCase().trim()}`);
    }
  }

  // All companies with a non-empty email
  const companiesWithEmail = await prisma.company.findMany({
    where: {
      AND: [{ email: { not: null } }, { email: { not: "" } }],
    },
    select: {
      id: true,
      companyName: true,
      documentNumber: true,
      documentType: true,
      email: true,
      emailStatus: true,
      serviceDate: true,
      usdotNumber: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const candidates = companiesWithEmail.filter((c) => {
    if (!c.email || !c.usdotNumber) return false;
    if (c.emailStatus === "unsubscribed") return false;
    const key = `${c.usdotNumber}:${c.email.toLowerCase().trim()}`;
    return !contactedSet.has(key);
  });

  const total = candidates.length;
  const paged = candidates.slice((page - 1) * perPage, page * perPage);

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
  const { companies, total, totalPages } = await fetchCandidates(page);

  function buildUrl(newPage: number) {
    return `/admin/emails?page=${newPage}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Email Campaigns ({total.toLocaleString()})</h1>
        <div className="flex gap-2">
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
