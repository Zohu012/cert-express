import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents, getSetting } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentButtons } from "@/components/payment-buttons";
import { PublicLayout } from "@/components/public-layout";

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

  const [priceCents, termsVersion] = await Promise.all([
    getPriceCents(),
    getSetting("terms_version"),
  ]);
  const priceDisplay = (priceCents / 100).toFixed(2);

  return (
    <PublicLayout>
      <main className="py-10">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-1">
                Get a Copy of Your FMCSA Document
              </h1>
              <p className="text-gray-500 text-sm">
                Publicly available document — instant digital delivery after
                payment
              </p>
            </div>

            {/* Document details */}
            <div className="border rounded-lg p-4 mb-6 bg-gray-50">
              <h2 className="font-semibold text-lg">{company.companyName}</h2>
              {company.dbaName && (
                <p className="text-sm text-gray-500">
                  D/B/A {company.dbaName}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">USDOT Number:</span>
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
                  <span className="text-gray-500">Service Date:</span>
                  <br />
                  <strong>
                    {(() => { const d = new Date(company.serviceDate); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; })()}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500">Delivery:</span>
                  <br />
                  <span className="text-gray-700">Instant digital download</span>
                </div>
                <div>
                  <span className="text-gray-500">Source:</span>
                  <br />
                  <span className="text-gray-700">Public FMCSA registry</span>
                </div>
              </div>
              {company.streetAddress && (
                <p className="mt-2 text-sm text-gray-600">
                  {company.streetAddress}, {company.city}, {company.state}{" "}
                  {company.zipCode}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-green-700">
                ${priceDisplay}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                One-time payment · Service fee for document retrieval &amp; delivery
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-6 text-xs text-gray-600">
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">✓</span> Public FMCSA Record
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">✓</span> Instant Delivery
              </span>
              <span className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className="text-green-600 font-bold">✓</span> Secure Payment
              </span>
            </div>

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
