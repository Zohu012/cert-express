import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents, getSetting } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentButtons } from "@/components/payment-buttons";
import { PublicLayout } from "@/components/public-layout";
import { PayPagePreview } from "@/components/pay-page-preview";

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

  const [priceCents, termsVersion, initialPriceRaw] = await Promise.all([
    getPriceCents(),
    getSetting("terms_version"),
    getSetting("initial_price_cents"),
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

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-4 text-xs text-gray-600">
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">&#10003;</span> Public FMCSA Record
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">&#10003;</span> Instant Delivery
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">&#10003;</span> Secure Payment
              </span>
            </div>

            {/* Post-payment clarity */}
            <p className="text-xs text-center text-gray-500 mb-5">
              Download available immediately after payment
            </p>

            {/* Document details (collapsed, secondary) */}
            <details className="mb-5 border rounded-lg bg-gray-50">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer">
                Document Details
              </summary>
              <div className="px-4 pb-4 pt-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <br />
                    <strong>{company.companyName}</strong>
                  </div>
                  {company.dbaName && (
                    <div>
                      <span className="text-gray-500">DBA:</span>
                      <br />
                      <strong>{company.dbaName}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">USDOT:</span>
                    <br />
                    <strong>{company.usdotNumber}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Document:</span>
                    <br />
                    <strong>{company.documentNumber}</strong>
                  </div>
                  <div>
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
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <br />
                    <strong>{dateStr}</strong>
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

            <PaymentButtons
              companyId={company.id}
              termsVersion={termsVersion || "1.0"}
            />
          </Card>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              &larr; Back to search
            </Link>
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
