import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "Contact | CertExpress",
};

export default function ContactPage() {
  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-gray-500 mb-8">
          We typically respond within 1–2 business days.
        </p>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Email</h2>
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline text-lg"
              >
                orders@certexpresss.com
              </a>
              <p className="text-sm text-gray-500 mt-1">
                For order inquiries, refund requests, and download issues
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">
              When contacting us, please include:
            </h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
              <li>The email address used during checkout</li>
              <li>Your company name or USDOT number</li>
              <li>A brief description of your issue</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Refund or download issue?</strong> We aim to resolve all
              support requests within 1 business day. If your download link
              expired or the file was incorrect, we will resend it or issue a
              full refund.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          CertExpress is operated by NaachTech and is not affiliated with any
          government agency.
        </p>
      </div>
    </PublicLayout>
  );
}
