import { PublicLayout } from "@/components/public-layout";
import { getSetting } from "@/lib/settings";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms of Service | CertExpress",
};

const DEFAULT_TERMS = `
## 1. Service Description

CertExpress retrieves and delivers publicly available FMCSA (Federal Motor Carrier Safety Administration) documents, including Certificates of Authority, Permits, and Licenses. These documents are free public records available at fmcsa.dot.gov.

**You are purchasing the retrieval and instant delivery service — not the document itself.**

## 2. No Government Affiliation

CertExpress is a private service operated by NaachTech. We are not affiliated with FMCSA, the US Department of Transportation, or any government agency. We do not issue, certify, or endorse any documents.

## 3. Delivery Terms

After successful payment, you will receive:
- A download link on the confirmation page
- An email with your download link sent to the address provided by your payment processor

Download links are valid for 72 hours from the time of purchase and allow up to 5 downloads.

## 4. Refund Policy

Refunds are issued when:
- The file delivered is corrupt or unreadable
- The document belongs to a different company than requested
- The download link never functioned and we were unable to resend it

Once the document has been accessed, downloaded, or delivered to your email, the sale is final. See our Refund Policy for details.

## 5. Digital Service Waiver

By completing your purchase, you expressly agree that the digital service begins immediately upon payment confirmation. You acknowledge and **waive your right of withdrawal or cancellation** once the document has been delivered or accessed.

## 6. Limitation of Liability

CertExpress is not liable for:
- Errors, inaccuracies, or omissions in source documents published by FMCSA
- Delays caused by payment processor issues
- Loss of data or business resulting from use of delivered documents

Our liability is limited to the amount paid for the specific order in question.

## 7. Acceptable Use

You agree to use CertExpress only for lawful purposes. You may not resell, redistribute, or commercially exploit documents obtained through this service.

## 8. Governing Law

These terms are governed by the laws of the United States of America. Any disputes shall be resolved in the jurisdiction where NaachTech operates.

## 9. Changes to Terms

We may update these terms at any time. Continued use of the service constitutes acceptance of updated terms.

## 10. Contact

Questions about these terms? Email us: orders@certexpresss.com
`.trim();

export default async function TermsPage() {
  const [customContent, termsVersion] = await Promise.all([
    getSetting("terms_content"),
    getSetting("terms_version"),
  ]);

  const content = customContent || DEFAULT_TERMS;
  const version = termsVersion || "1.0";

  // Simple markdown-to-HTML renderer for headings and paragraphs
  const sections = content
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith("## ")) {
        const text = block.replace(/^## /, "");
        return (
          <h2
            key={i}
            className="text-xl font-semibold text-gray-900 mt-8 mb-3"
          >
            {text}
          </h2>
        );
      }
      if (block.startsWith("# ")) {
        const text = block.replace(/^# /, "");
        return (
          <h1 key={i} className="text-2xl font-bold text-gray-900 mt-6 mb-3">
            {text}
          </h1>
        );
      }
      // Bullet list
      if (block.startsWith("- ")) {
        const items = block.split("\n").filter((l) => l.startsWith("- "));
        return (
          <ul key={i} className="list-disc pl-5 space-y-1 text-gray-700">
            {items.map((item, j) => (
              <li key={j}>{item.replace(/^- /, "")}</li>
            ))}
          </ul>
        );
      }
      // Bold inline text support
      const rendered = block.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );
      return (
        <p
          key={i}
          className="text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      );
    });

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-1">
          Version {version} · Last updated: April 2026
        </p>
        <p className="text-gray-500 mb-8">Operated by NaachTech</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> CertExpress is a private service. You
            are paying for document retrieval and delivery — not the document
            itself. Documents are publicly available at{" "}
            <a
              href="https://fmcsa.dot.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              fmcsa.dot.gov
            </a>
            .
          </p>
        </div>

        <div className="space-y-3">{sections}</div>

        <div className="mt-10 border-t pt-6 text-sm text-gray-500 space-y-1">
          <p>
            For our refund policy, see:{" "}
            <Link href="/refund" className="text-blue-600 hover:underline">
              certexpresss.com/refund
            </Link>
          </p>
          <p>
            For our privacy policy, see:{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              certexpresss.com/privacy
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
