import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PublicLayout } from "@/components/public-layout";
import { Card } from "@/components/ui/card";
import {
  maskEmail,
  maskOfficerName,
  maskPhone,
  maskStreet,
} from "@/lib/mask";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ usdotNumber: string }>;
};

async function fetchCompany(usdotNumber: string) {
  const company = await prisma.otruckingCompany.findUnique({
    where: { usdotNumber },
  });
  if (!company || company.scrapeStatus !== "success") return null;
  return company;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { usdotNumber } = await params;
  const company = await fetchCompany(usdotNumber);
  if (!company) {
    return { title: "Carrier not found" };
  }
  const name = company.companyName || `USDOT ${company.usdotNumber}`;
  const loc = [company.city, company.state].filter(Boolean).join(", ");
  const descBits = [
    name,
    `USDOT ${company.usdotNumber}`,
    loc,
    company.entityType,
    company.powerUnits ? `${company.powerUnits} power units` : null,
  ].filter(Boolean);

  return {
    title: `${name} (USDOT ${company.usdotNumber}) — FMCSA Carrier Profile`,
    description: `FMCSA carrier profile for ${descBits.join(" · ")}. View DOT status, authority, fleet size, and request the Certificate of Authority.`,
    alternates: { canonical: `/companies/${company.usdotNumber}` },
    openGraph: {
      title: `${name} — USDOT ${company.usdotNumber}`,
      description: `FMCSA carrier profile${loc ? ` — ${loc}` : ""}.`,
      type: "profile",
    },
  };
}

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default async function CompanyDetail({ params }: PageProps) {
  const { usdotNumber } = await params;
  const company = await fetchCompany(usdotNumber);
  if (!company) notFound();

  const cargoTypes = parseJsonArray(company.cargoTypes);
  const equipmentTypes = parseJsonArray(company.equipmentTypes);
  const fleetBreakdown = parseJsonArray(company.fleetBreakdown);

  const name = company.companyName || `USDOT ${company.usdotNumber}`;
  const loc = [company.city, company.state].filter(Boolean).join(", ");

  // JSON-LD: public fields only. No masked PII. Address uses locality only.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    identifier: `USDOT ${company.usdotNumber}`,
    url: `https://www.certexpresss.com/companies/${company.usdotNumber}`,
    ...(company.city || company.state || company.zipCode
      ? {
          address: {
            "@type": "PostalAddress",
            ...(company.city ? { addressLocality: company.city } : {}),
            ...(company.state ? { addressRegion: company.state } : {}),
            ...(company.zipCode ? { postalCode: company.zipCode } : {}),
            addressCountry: "US",
          },
        }
      : {}),
  };

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-10">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-sm text-blue-200">
            <Link href="/companies" className="hover:text-white">
              ← All companies
            </Link>
          </p>
          <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            {name}
          </h1>
          <p className="mt-2 text-blue-100 text-sm sm:text-base">
            USDOT {company.usdotNumber}
            {loc && <> &middot; {loc}</>}
            {company.entityType && <> &middot; {company.entityType}</>}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {company.authorityStatus && (
              <span className="rounded-full bg-green-500/20 text-green-100 px-3 py-1 text-xs font-medium">
                Authority: {company.authorityStatus}
              </span>
            )}
            {company.dotStatus && (
              <span className="rounded-full bg-white/10 text-white px-3 py-1 text-xs font-medium">
                DOT Status: {company.dotStatus}
              </span>
            )}
            {company.safetyRating && (
              <span className="rounded-full bg-white/10 text-white px-3 py-1 text-xs font-medium">
                Safety: {company.safetyRating}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-3">
        {/* Company info */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            Carrier Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="USDOT Number" value={company.usdotNumber} />
            <Field label="Entity Type" value={company.entityType} />
            <Field label="Carrier Type" value={company.carrierType} />
            <Field label="Established" value={company.estYear} />
            <Field label="Authority Status" value={company.authorityStatus} />
            <Field label="Authority Since" value={company.authoritySince} />
            <Field label="DOT Status" value={company.dotStatus} />
            <Field label="Safety Rating" value={company.safetyRating} />
            <Field label="Power Units" value={company.powerUnits} />
            <Field label="Drivers" value={company.drivers} />
            <Field label="Hazmat" value={company.hazmat} />
            <Field label="Passenger Carrier" value={company.passengerCarrier} />
            <Field label="MCS-150 Update" value={company.mcs150Update} />
            <Field label="County" value={company.county} />
            <Field label="City" value={company.city} />
            <Field label="State" value={company.state} />
            <Field label="ZIP" value={company.zipCode} />
          </dl>

          {(cargoTypes.length > 0 ||
            equipmentTypes.length > 0 ||
            fleetBreakdown.length > 0) && (
            <div className="mt-8 space-y-5">
              {cargoTypes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Cargo Types
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cargoTypes.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {equipmentTypes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Equipment Types
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {equipmentTypes.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {fleetBreakdown.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Fleet Breakdown
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {fleetBreakdown.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Sidebar: masked contact + CTA */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Contact
            </h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Contact details are partially masked to protect privacy. Verified
              information appears on the official FMCSA Certificate of Authority.
            </p>
            <dl className="space-y-4">
              <Field
                label="Officer"
                value={
                  maskOfficerName(company.companyOfficer) || (
                    <span className="text-gray-400">—</span>
                  )
                }
              />
              <Field
                label="Phone"
                value={
                  maskPhone(company.phone) || (
                    <span className="text-gray-400">—</span>
                  )
                }
              />
              <Field
                label="Email"
                value={
                  maskEmail(company.email) || (
                    <span className="text-gray-400">—</span>
                  )
                }
              />
              <Field
                label="Street Address"
                value={
                  maskStreet(company.physicalAddress) || (
                    <span className="text-gray-400">—</span>
                  )
                }
              />
            </dl>
          </Card>

          <Card className="!bg-green-50 !border-green-200">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Get this company&apos;s Certificate of Authority
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Instant PDF delivery via secure payment.
            </p>
            <Link
              href={`/?type=dot&q=${encodeURIComponent(company.usdotNumber)}`}
              className="inline-flex items-center justify-center w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition"
            >
              Request Certificate →
            </Link>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
