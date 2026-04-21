import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { SearchResultCard } from "@/components/search-result-card";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const params = await searchParams;
  const searchType = params.type || "dot";
  const query = params.q || "";

  const priceCents = await getPriceCents();
  const priceDisplay = `$${(priceCents / 100).toFixed(2)}`;

  let companies: Awaited<ReturnType<typeof prisma.company.findMany>> = [];
  let searched = false;

  if (query) {
    searched = true;
    if (searchType === "dot") {
      companies = await prisma.company.findMany({
        where: { usdotNumber: query.trim() },
        orderBy: { serviceDate: "desc" },
        take: 50,
      });
    } else if (searchType === "mc") {
      companies = await prisma.company.findMany({
        where: { documentNumber: { contains: query.trim() } },
        orderBy: { serviceDate: "desc" },
        take: 50,
      });
    } else {
      companies = await prisma.company.findMany({
        where: { companyName: { contains: query.trim() } },
        orderBy: { serviceDate: "desc" },
        take: 50,
      });
    }
  }

  // Landing-page stats (only queried when not showing search results, so
  // search remains snappy and stats don't run a query per search submit).
  let stats: { companies: number; states: number; delivered: number } | null = null;
  if (!searched) {
    const [companiesCount, statesRows, deliveredCount] = await Promise.all([
      prisma.company.count(),
      prisma.company.findMany({
        where: { state: { not: null } },
        distinct: ["state"],
        select: { state: true },
      }),
      prisma.order.count({ where: { status: "completed" } }),
    ]);
    stats = {
      companies: companiesCount,
      states: statesRows.length,
      delivered: deliveredCount,
    };
  }

  return (
    <PublicLayout>
      {/* Hero + Search */}
      <section
        id="search"
        className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-16"
      >
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your FMCSA Certificate of Authority,
            <span className="block text-green-300 mt-2">delivered in minutes.</span>
          </h1>
          <p className="text-blue-100 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
            Search by USDOT Number, MC/MX Number, or Company Name. Secure payment.
            Instant download.
          </p>

          <Card className="text-left !bg-white !border-blue-200 !shadow-xl">
            <form action="/" method="GET">
              <div className="flex flex-wrap gap-4 mb-4">
                {[
                  { value: "dot", label: "USDOT Number" },
                  { value: "mc", label: "MC/MX Number" },
                  { value: "name", label: "Name" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-gray-700 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      defaultChecked={searchType === opt.value}
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Enter Value"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
                <Button type="submit">Search</Button>
              </div>
            </form>
          </Card>

          <p className="mt-4 text-sm text-blue-200">
            Or{" "}
            <Link href="/companies" className="underline hover:text-white">
              browse all carriers
            </Link>{" "}
            in our public directory.
          </p>
        </div>
      </section>

      {/* Results block — unchanged behavior */}
      {searched && (
        <div className="max-w-5xl mx-auto px-4 py-8">
          {companies.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No results found for &quot;{query}&quot;</p>
              <p className="text-sm mt-1">Try a different search term.</p>
            </div>
          )}

          {companies.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">
                    {companies.length} result{companies.length !== 1 ? "s" : ""}{" "}
                    found
                  </p>
                  {companies.length === 1 && (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Match Found
                    </span>
                  )}
                </div>
              </div>

              {companies.map((company) => {
                const d = new Date(company.serviceDate);
                const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                return (
                  <SearchResultCard
                    key={company.id}
                    company={{
                      id: company.id,
                      companyName: company.companyName,
                      dbaName: company.dbaName,
                      usdotNumber: company.usdotNumber,
                      documentNumber: company.documentNumber,
                      documentType: company.documentType,
                      serviceDate: dateStr,
                      city: company.city,
                      state: company.state,
                      previewFilename: company.previewFilename,
                    }}
                    priceDisplay={priceDisplay}
                  />
                );
              })}

              <div className="text-center pt-3 space-y-1">
                <p className="text-xs text-gray-500">
                  Most carriers use this for onboarding and broker setup
                </p>
                <p className="text-xs text-gray-400">
                  Private service — not affiliated with FMCSA or U.S. Department
                  of Transportation
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <>
          {/* Trust strip */}
          <section className="border-b border-gray-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { title: "Instant Delivery", desc: "PDF emailed the moment payment clears" },
                { title: "Official Documents", desc: "Sourced from public FMCSA filings" },
                { title: "Secure Payments", desc: "Stripe & PayPal — your card is never stored" },
                { title: "24/7 Access", desc: "Search, pay, and download any time" },
              ].map((t) => (
                <div key={t.title} className="px-2">
                  <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className="py-14 bg-gray-50">
            <div className="max-w-5xl mx-auto px-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
                How It Works
              </h2>
              <p className="text-center text-gray-600 mb-10">
                Three steps from search to signed PDF.
              </p>
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Search",
                    desc: "Enter a USDOT, MC/MX, or company name to locate the FMCSA record.",
                  },
                  {
                    step: "2",
                    title: "Pay",
                    desc: "Complete a secure one-time payment via credit card or PayPal.",
                  },
                  {
                    step: "3",
                    title: "Download",
                    desc: "Get the PDF instantly, plus a copy emailed for your records.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Why CertExpress */}
          <section className="py-14 bg-white">
            <div className="max-w-5xl mx-auto px-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
                Why carriers choose CertExpress
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: "No FMCSA trip required",
                    desc: "Skip the office visit — your certificate arrives by email.",
                  },
                  {
                    title: "Searchable archive",
                    desc: "Daily-updated index of certificates, permits, and licenses.",
                  },
                  {
                    title: "Broker-ready PDF",
                    desc: "Clean, official-format document suited for onboarding packets.",
                  },
                  {
                    title: "Refund guarantee",
                    desc: "If we can't deliver your document, you don't pay. Simple.",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition"
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Stats band */}
          {stats && (
            <section className="py-12 bg-blue-900 text-white">
              <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-green-300">
                    {stats.companies.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-blue-200">FMCSA records indexed</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-green-300">
                    {stats.states}
                  </p>
                  <p className="mt-1 text-sm text-blue-200">U.S. states covered</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-green-300">
                    {(200 + stats.delivered).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-blue-200">Documents delivered</p>
                </div>
              </div>
            </section>
          )}

          {/* FAQ teaser */}
          <section className="py-14 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
                Frequently asked
              </h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Can I review my details before completing the download?",
                    a: "Yes. You can view key document details and a preview before proceeding, so you can confirm it matches your company record."
                  },
                  {
                    q: "How quickly will I receive my document?",
                    a: "Instantly. Once your payment is successful, the PDF is available on-screen and sent to your email."
                  },
                  {
                    q: "What if my company details are incorrect?",
                    a: "If your company details are incorrect, you will receive a full refund. No document, no charge."
                  }
                ].map((item) => (
                  <div key={item.q} className="bg-white border border-gray-200 rounded-lg p-5">
                    <p className="font-semibold text-gray-900">{item.q}</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
              <p className="text-center mt-6">
                <Link href="/faq" className="text-sm font-medium text-blue-700 hover:underline">
                  See all FAQs →
                </Link>
              </p>
            </div>
          </section>

          {/* CTA band */}
          <section className="py-12 bg-white border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                Need a carrier&apos;s Certificate of Authority?
              </h2>
              <p className="text-gray-600 mb-6">
                Search our database by USDOT, MC/MX, or company name and download in minutes.
              </p>
              <Link
                href="/#search"
                className="inline-flex items-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-700 transition"
              >
                Start a search
              </Link>
            </div>
          </section>
        </>
      )}
    </PublicLayout>
  );
}
