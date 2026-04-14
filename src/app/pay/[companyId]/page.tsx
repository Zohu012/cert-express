import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPriceCents } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentButtons } from "@/components/payment-buttons";

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

  const priceCents = await getPriceCents();
  const priceDisplay = (priceCents / 100).toFixed(2);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            CertExpress
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-1">
                Get Your FMCSA Certificate
              </h1>
              <p className="text-gray-500">
                Official document delivered instantly after payment
              </p>
            </div>

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
              </div>
              {company.streetAddress && (
                <p className="mt-2 text-sm text-gray-600">
                  {company.streetAddress}, {company.city}, {company.state}{" "}
                  {company.zipCode}
                </p>
              )}
            </div>

            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-green-700">
                ${priceDisplay}
              </p>
              <p className="text-sm text-gray-500 mt-1">One-time payment</p>
            </div>

            <PaymentButtons companyId={company.id} />
          </Card>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              &larr; Back to search
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
