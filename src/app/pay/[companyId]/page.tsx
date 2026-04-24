import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents, getSetting } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentButtons } from "@/components/payment-buttons";
import { PublicLayout } from "@/components/public-layout";
import { PayPagePreview } from "@/components/pay-page-preview";
import { StickyPayBar } from "@/components/sticky-pay-bar";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company || !company.pdfFilename) return notFound();

  const [priceCents, termsVersion, initialPriceRaw, successfulOrderCount] =
    await Promise.all([
      getPriceCents(),
      getSetting("terms_version"),
      getSetting("initial_price_cents"),
      prisma.order.count({ where: { status: "completed" } }),
    ]);
  const priceDisplay = (priceCents / 100).toFixed(2);
  const initialPriceCents = initialPriceRaw ? parseInt(initialPriceRaw) : null;
  const initialPriceDisplay =
    initialPriceCents && initialPriceCents > priceCents
      ? (initialPriceCents / 100).toFixed(2)
      : null;

  const dateStr = (() => {
    const d = new Date(company.serviceDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  })();

  const previewUrl = company.previewFilename
    ? `/api/previews/${company.previewFilename}`
    : null;

  return (
    <PublicLayout>
      <main className="py-10">
        <div className="max-w-2xl mx-auto px-4">
          {/* Identity confirmation block */}
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
            <p className="text-sm text-green-800">
              This document matches your FMCSA record for{" "}
              <strong>{company.companyName}</strong>
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-1 text-xs text-green-700">
              <span>{company.documentType}: {company.documentNumber}</span>
              <span>DOT: {company.usdotNumber}</span>
              <span>Date: {dateStr}</span>
            </div>
            
          </div>

          <Card>
            {/* Preview image — above the fold */}
            {previewUrl && (
              <PayPagePreview
                previewUrl={previewUrl}
                companyName={company.companyName}
                documentNumber={company.documentNumber}
                serviceDate={dateStr}
              />
            )}

            {/* Pricing section */}
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Get your certificate now — no waiting for mail
              </p>
              {initialPriceDisplay && (
                <p className="text-xl font-semibold text-red-500 line-through leading-tight">
                  ${initialPriceDisplay}
                </p>
              )}
              <p className="text-3xl font-bold text-green-700">
                ${priceDisplay}
                {initialPriceDisplay && (
                  <span className="ml-2 text-sm font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full align-middle">
                    Save ${(initialPriceCents! / 100 - priceCents / 100).toFixed(2)}
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                One-time payment
              </p>
            </div>

            {/* Risk-reversal row — replaces old trust badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="text-green-600 text-lg leading-none mt-0.5">
                  &#9889;
                </span>
                <div>
                  <div className="text-xs font-semibold text-gray-800">
                    Instant delivery
                  </div>
                  <div className="text-[11px] text-gray-500 leading-snug">
                    PDF ready to download right after payment
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="text-green-600 text-lg leading-none mt-0.5">
                  &#128274;
                </span>
                <div>
                  <div className="text-xs font-semibold text-gray-800">
                    Secure checkout via Stripe
                  </div>
                  <div className="text-[11px] text-gray-500 leading-snug">
                    Your card details never touch our servers
                  </div>
                </div>
              </div>
              <Link
                href="/refund"
                target="_blank"
                className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition"
              >
                <span className="text-green-600 text-lg leading-none mt-0.5">
                  &#128179;
                </span>
                <div>
                  <div className="text-xs font-semibold text-gray-800">
                    30-day money-back guarantee
                  </div>
                  <div className="text-[11px] text-gray-500 leading-snug">
                    Not satisfied? Request a refund &mdash; see policy
                  </div>
                </div>
              </Link>
            </div>

            <PaymentButtons
              companyId={company.id}
              termsVersion={termsVersion || "1.0"}
              priceDisplay={priceDisplay}
              priceCents={priceCents}
            />

            {/* Document details (collapsed, now below CTA) */}
            <details className="mt-5 border rounded-lg bg-gray-50">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer">
                Document Details
              </summary>
              <div className="px-4 pb-4 pt-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="text-gray-500">Company:</span>
                    <br />
                    <strong className="block break-words">{company.companyName}</strong>
                  </div>
                  {company.dbaName && (
                    <div className="min-w-0">
                      <span className="text-gray-500">DBA:</span>
                      <br />
                      <strong className="block break-words">{company.dbaName}</strong>
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-gray-500">USDOT:</span>
                    <br />
                    <strong className="block break-words">{company.usdotNumber}</strong>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">Document:</span>
                    <br />
                    <strong className="block break-words">{company.documentNumber}</strong>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">Type:</span>
                    <br />
                    <Badge
                      color={
                        company.documentType === "CERTIFICATE"
                          ? "blue"
                          : company.documentType === "PERMIT"
                            ? "green"
                            : "yellow"
                      }
                    >
                      {company.documentType}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500">Date:</span>
                    <br />
                    <strong className="block break-words">{dateStr}</strong>
                  </div>
                </div>
                {company.streetAddress && (
                  <p className="mt-2 text-sm text-gray-600">
                    {company.streetAddress}, {company.city}, {company.state}{" "}
                    {company.zipCode}
                  </p>
                )}
              </div>
            </details>
          </Card>

          <div className="mt-4 text-center pb-24 md:pb-0">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              &larr; Back to search
            </Link>
          </div>
        </div>
      </main>
      <StickyPayBar priceDisplay={priceDisplay} />
    </PublicLayout>
  );
}
