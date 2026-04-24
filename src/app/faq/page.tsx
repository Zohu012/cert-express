import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "FAQ | CertExpress",
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    q: "Is this an official government website?",
    a: "No. CertExpress is a private service operated by NaachTech. We are not affiliated with FMCSA, the US Department of Transportation, or any government agency. You are paying for our document retrieval and instant delivery service.",
  },
  {
    q: "Are these real, official FMCSA documents?",
    a: "Yes. We retrieve exact copies of documents directly from the public FMCSA database. The documents are the same ones published by the government — we simply find and deliver them instantly, saving you hours of manual searching.",
  },
  {
    q: "When will I receive my document?",
    a: "Immediately after your payment is confirmed. You will be taken to a download page and also receive an email with your download link within minutes.",
  },
  {
    q: "What if I cannot download my document?",
    a: "Email us at orders@certexpresss.com with your order email address. We will resend the download link or issue a refund if the document was not delivered successfully.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes, if the file is corrupt, belongs to the wrong company, or the download link never worked. Once you have successfully accessed or downloaded your document, the sale is final — digital products cannot be returned once delivered.",
  },
  {
    q: "Why isn't my company showing up in search results?",
    a: "Our database is updated daily with new FMCSA decisions. If your certificate was issued very recently, it may appear within 1–2 business days. Only documents published in the daily FMCSA release are available.",
  },
  {
    q: "How long is the download link valid?",
    a: "Download links are valid for 72 hours from the time of purchase and allow up to 5 downloads. If your link has expired, contact us at orders@certexpresss.com.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept credit and debit cards via Stripe, and PayPal. All payment processing is handled securely by these providers.",
  },
  {
    q: "Is my payment secure?",
    a: "Yes. All payments are processed by Stripe or PayPal. CertExpress never sees or stores your card details. Both processors use industry-standard encryption and security.",
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-500 mb-8">
          Everything you need to know about CertExpress
        </p>

        <div className="space-y-4">
          {faqs.map((item, i) => (
            <details
              key={i}
              className="group border border-gray-200 rounded-lg"
              open={i === 0}
            >
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-medium text-gray-900 hover:bg-gray-50 rounded-lg">
                <span>{item.q}</span>
                <span className="ml-4 text-gray-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 text-gray-700 text-sm leading-relaxed border-t border-gray-100 pt-3">
                {item.a}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-10 bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
          <p className="text-gray-700 text-sm mb-2">
            Still have questions? We&rsquo;re here to help.
          </p>
          <a
            href="mailto:orders@certexpresss.com"
            className="text-blue-600 font-medium hover:underline"
          >
            orders@certexpresss.com
          </a>
        </div>
      </div>
    </PublicLayout>
  );
}
