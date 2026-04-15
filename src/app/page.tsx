import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";

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

  return (
    <PublicLayout>
      {/* Hero + Search */}
      <div className="bg-blue-800 text-white py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-3">
            FMCSA Certificate of Authority Lookup
          </h1>
          <p className="text-blue-200 mb-8">
            Search by USDOT Number, MC/MX Number, or Company Name
          </p>

          <Card className="text-left !bg-blue-50 !border-blue-200">
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
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {searched && companies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No results found for &quot;{query}&quot;</p>
            <p className="text-sm mt-1">Try a different search term.</p>
          </div>
        )}

        {companies.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {companies.length} result{companies.length !== 1 ? "s" : ""}{" "}
                found
              </p>
            </div>
            {companies.map((company) => (
              <Card key={company.id} className="hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {company.companyName}
                    </h3>
                    {company.dbaName && (
                      <p className="text-sm text-gray-500">
                        D/B/A {company.dbaName}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                      <span>
                        <strong>DOT:</strong> {company.usdotNumber}
                      </span>
                      <span>
                        <strong>{company.documentType}:</strong>{" "}
                        {company.documentNumber}
                      </span>
                      <span>
                        <strong>Date:</strong>{" "}
                        {(() => { const d = new Date(company.serviceDate); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; })()}
                      </span>
                      <span>
                        {company.city}, {company.state}
                      </span>
                    </div>
                  </div>
                  {company.previewFilename && (
                    <Link href={`/pay/${company.id}`} className="flex-shrink-0 hidden sm:block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/previews/${company.previewFilename}`}
                        alt="Document preview"
                        width={112}
                        className="w-28 rounded border border-gray-200 shadow-sm hover:opacity-80 transition"
                      />
                    </Link>
                  )}
                  <Link
                    href={`/pay/${company.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition whitespace-nowrap self-center"
                  >
                    Get a Copy &mdash; {priceDisplay}
                  </Link>
                </div>
              </Card>
            ))}

            {/* Disclaimer under results */}
            <p className="text-xs text-gray-400 text-center pt-2">
              Documents are public records published by FMCSA. You are
              purchasing a document retrieval and delivery service.
            </p>
          </div>
        )}

        {!searched && (
          <div>
            {/* "How It Works" section */}
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
                How It Works
              </h2>
              <div className="grid gap-4 sm:grid-cols-3 mb-10">
                {[
                  {
                    step: "1",
                    title: "Search",
                    desc: "Enter your USDOT or MC/MX number to find your FMCSA document in our daily-updated database.",
                  },
                  {
                    step: "2",
                    title: "Pay",
                    desc: "Complete a secure one-time payment via credit card or PayPal.",
                  },
                  {
                    step: "3",
                    title: "Download",
                    desc: "Receive your document instantly — download from the page or via your confirmation email.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-3">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="text-center text-gray-400">
                <svg
                  className="mx-auto h-12 w-12 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-base">
                  Search for a company to get a copy of their FMCSA document
                </p>
                <p className="text-xs mt-1">
                  CertExpress is a private service — not affiliated with FMCSA
                  or any government agency
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
