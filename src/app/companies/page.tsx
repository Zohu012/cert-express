import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PublicLayout } from "@/components/public-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Trucking Companies Directory — FMCSA Carrier Profiles",
  description:
    "Browse FMCSA-registered trucking companies by name, USDOT number, and state. Public carrier profiles with authority status, fleet size, and more.",
  alternates: { canonical: "/companies" },
};

const PAGE_SIZE = 50;

export default async function CompaniesIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const q = (sp.q || "").trim();

  const where = {
    scrapeStatus: "success" as const,
    ...(q ? { companyName: { contains: q } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.otruckingCompany.count({ where }),
    prisma.otruckingCompany.findMany({
      where,
      orderBy: { companyName: "asc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/companies?${qs}` : "/companies";
  }

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Trucking Companies Directory
          </h1>
          <p className="mt-3 text-blue-100 max-w-2xl">
            Public profiles of FMCSA-registered motor carriers. Use this directory
            to find a carrier&apos;s USDOT record, then request the Certificate of
            Authority document.
          </p>

          <form action="/companies" method="GET" className="mt-6 flex gap-3 max-w-xl">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search by company name"
              className="flex-1 rounded-lg border border-white/20 bg-white/10 placeholder-blue-200 text-white px-4 py-2.5 text-sm focus:bg-white focus:text-gray-900 focus:placeholder-gray-400 outline-none"
            />
            <Button type="submit" variant="success">Search</Button>
          </form>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 mb-4">
          {total.toLocaleString()} {total === 1 ? "company" : "companies"}
          {q && (
            <>
              {" "}matching <span className="font-medium text-gray-700">&quot;{q}&quot;</span>
            </>
          )}
          {" "}&middot; page {pageNum} of {totalPages}
        </p>

        {rows.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">
              No carriers found{q ? ` for "${q}"` : ""}.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${encodeURIComponent(c.usdotNumber)}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">
                      {c.companyName || "Unnamed carrier"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      USDOT {c.usdotNumber}
                      {c.city && c.state && (
                        <>
                          {" "}&middot; {c.city}, {c.state}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {c.entityType && (
                      <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5">
                        {c.entityType}
                      </span>
                    )}
                    {c.powerUnits && (
                      <span className="rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5">
                        {c.powerUnits} power units
                      </span>
                    )}
                    {c.authorityStatus && (
                      <span className="rounded-full bg-green-50 text-green-700 px-2.5 py-0.5">
                        {c.authorityStatus}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            {pageNum > 1 ? (
              <Link
                href={pageHref(pageNum - 1)}
                className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">
                ← Previous
              </span>
            )}
            <span className="text-gray-500">
              Page {pageNum} / {totalPages}
            </span>
            {pageNum < totalPages ? (
              <Link
                href={pageHref(pageNum + 1)}
                className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">
                Next →
              </span>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
