import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
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

  const settings = await getSettings([
    "price_cents",
    "terms_version",
    "initial_price_cents",
  ]);
  const priceCents = settings.price_cents ? parseInt(settings.price_cents, 10) : 3000;
  const termsVersion = settings.terms_version ?? null;
  const initialPriceRaw = settings.initial_price_cents ?? null;
  const priceDisplay = (priceCents / 100).toFixed(2);
  const initialPriceCents = initialPriceRaw ? parseInt(initialPriceRaw) : null;
  const initialPriceDisplay =
    initialPriceCents && initialPriceCents > priceCents
      ? (initialPriceCents / 100).toFixed(2)
      : null;
  const savingsDisplay =
    initialPriceCents && initialPriceCents > priceCents
      ? (initialPriceCents / 100 - priceCents / 100).toFixed(2)
      : null;

  const dateStr = (() => {
    const d = new Date(company.serviceDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  })();

  const previewUrl = company.previewFilename
    ? `/api/previews/${company.previewFilename}`
    : null;

  const identityBanner = (
    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
      <p className="text-sm text-green-800">
        FMCSA record for <strong>{company.companyName}</strong>
      </p>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-1 text-xs text-green-700">
        <span>
          {company.documentType}: {company.documentNumber}
        </span>
        <span>DOT: {company.usdotNumber}</span>
        <span>Date: {dateStr}</span>
      </div>
    </div>
  );

  return (
    <PublicLayout>
      {previewUrl && (
        <link
          rel="preload"
          as="image"
          href={previewUrl}
          fetchPriority="high"
        />
      )}
      <main className="py-6 lg:py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Mobile-only identity banner (top of page) */}
          <div className="mb-4 lg:hidden">{identityBanner}</div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN — preview + details */}
            <div className="lg:col-span-7">
              {previewUrl ? (
                <Card>
                  <PayPagePreview
                    previewUrl={previewUrl}
                    companyName={company.companyName}
                    documentNumber={company.documentNumber}
                    serviceDate={dateStr}
                  />

                  <details className="mt-2 border-t pt-3 border-gray-100">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Document Details
                    </summary>
                    <div className="pt-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="text-gray-500">Company:</span>
                          <br />
                          <strong className="block break-words">
                            {company.companyName}
                          </strong>
                        </div>
                        {company.dbaName && (
                          <div className="min-w-0">
                            <span className="text-gray-500">DBA:</span>
                            <br />
                            <strong className="block break-words">
                              {company.dbaName}
                            </strong>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-gray-500">USDOT:</span>
                          <br />
                          <strong className="block break-words">
                            {company.usdotNumber}
                          </strong>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500">Document:</span>
                          <br />
                          <strong className="block break-words">
                            {company.documentNumber}
                          </strong>
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
                          <strong className="block break-words">
                            {dateStr}
                          </strong>
                        </div>
                      </div>
                      {company.streetAddress && (
                        <p className="mt-2 text-sm text-gray-600">
                          {company.streetAddress}, {company.city},{" "}
                          {company.state} {company.zipCode}
                        </p>
                      )}
                    </div>
                  </details>
                </Card>
              ) : (
                <Card>
                  <details>
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Document Details
                    </summary>
                    <div className="pt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-500">Company:</span>
                        <br />
                        <strong className="block break-words">
                          {company.companyName}
                        </strong>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500">USDOT:</span>
                        <br />
                        <strong className="block break-words">
                          {company.usdotNumber}
                        </strong>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500">Document:</span>
                        <br />
                        <strong className="block break-words">
                          {company.documentNumber}
                        </strong>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500">Date:</span>
                        <br />
                        <strong className="block break-words">{dateStr}</strong>
                      </div>
                    </div>
                  </details>
                </Card>
              )}

              <div className="mt-4 text-center">
                <Link
                  href="/"
                  className="text-sm text-blue-600 hover:underline"
                >
                  &larr; Back to search
                </Link>
              </div>
            </div>

            {/* RIGHT COLUMN — desktop pay card. Hidden on mobile (sticky sheet handles it). */}
            <div className="hidden lg:block lg:col-span-5">
              <div className="lg:sticky lg:top-20 space-y-4">
                {identityBanner}
                <Card>
                  <PaymentButtons
                    companyId={company.id}
                    termsVersion={termsVersion || "1.0"}
                    priceDisplay={priceDisplay}
                    priceCents={priceCents}
                    initialPriceDisplay={initialPriceDisplay}
                    savingsDisplay={savingsDisplay}
                  />
                </Card>
              </div>
            </div>
          </div>

          {/* Spacer so the sticky bottom sheet doesn't cover the back-link on mobile */}
          <div className="pb-24 lg:pb-0" />
        </div>
      </main>

      <StickyPayBar
        companyId={company.id}
        termsVersion={termsVersion || "1.0"}
        priceDisplay={priceDisplay}
        priceCents={priceCents}
        initialPriceDisplay={initialPriceDisplay}
        savingsDisplay={savingsDisplay}
      />
    </PublicLayout>
  );
}
