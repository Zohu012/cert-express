import { PublicLayout } from "@/components/public-layout";
import Link from "next/link";

export const metadata = {
  title: "Refund Policy | CertExpress",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
        <p className="text-gray-500 mb-8">
          Last updated: April 2026
        </p>

        <div className="space-y-8 text-gray-700">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <p className="text-blue-900 text-sm">
              CertExpress sells a <strong>digital delivery service</strong>. You
              are purchasing the retrieval and instant delivery of a publicly
              available document — not the document itself.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              When Refunds Are Issued
            </h2>
            <p className="mb-3">
              You are eligible for a full refund in the following circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>The PDF file is corrupt or unreadable</li>
              <li>The document delivered belongs to a different company</li>
              <li>
                The download link never worked and we were unable to resend it
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              When Refunds Are Not Available
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p>
                <strong>All purchases are for digital services.</strong> Once
                the document has been accessed, downloaded, or delivered to your
                email, the sale is final and no refund can be issued.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Digital Service Waiver
            </h2>
            <p>
              By completing a purchase on CertExpress, you expressly agree that
              the digital service begins immediately upon payment confirmation.
              You acknowledge and waive your right of withdrawal or cancellation
              once the document has been delivered or accessed. This waiver is
              confirmed by the consent checkbox displayed before payment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How to Request a Refund
            </h2>
            <p className="mb-3">
              To request a refund, email us at:
            </p>
            <a
              href="mailto:orders@certexpresss.com"
              className="text-blue-600 font-medium hover:underline text-lg"
            >
              orders@certexpresss.com
            </a>
            <p className="mt-3 text-sm">
              Please include your order email address and a brief description of
              the issue. We will respond within 1–2 business days.
            </p>
          </section>

          <div className="border-t pt-6 text-sm text-gray-500">
            <p>
              For full terms of service, see our{" "}
              <Link href="/terms" className="text-blue-600 hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </div>

          <section className="text-sm text-gray-600 leading-relaxed">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              About CertExpress
            </h2>
            <p>
              CertExpress is a private FMCSA document-retrieval service that
              delivers Certificates of Authority, operating permits, and motor
              carrier licenses as instant PDF downloads. Our refund policy is
              built around one rule: if we could not deliver a usable document,
              you do not pay.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
