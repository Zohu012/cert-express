import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "About CertExpress | FMCSA Document Delivery Service",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">About CertExpress</h1>
        <p className="text-gray-500 mb-8">Operated by NaachTech</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What We Do</h2>
            <p>
              CertExpress is a <strong>private convenience service</strong> that
              retrieves and delivers publicly available FMCSA (Federal Motor
              Carrier Safety Administration) documents — including Certificates
              of Authority, Permits, and Licenses — directly to your inbox.
            </p>
            <p className="mt-2">
              Don&apos;t wait for mail delivery. CertExpress gives you instant
              access to your document in a clean, ready-to-use PDF format.
            </p>
          </section>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> CertExpress is <strong>not</strong> a
              government website and is not affiliated with FMCSA, the US
              Department of Transportation, or any government agency.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Search",
                  desc: "Enter your USDOT number, MC/MX number, or company name to find your document.",
                },
                {
                  step: "2",
                  title: "Pay",
                  desc: "Complete a secure one-time payment via credit/debit card (Stripe) or PayPal.",
                },
                {
                  step: "3",
                  title: "Download",
                  desc: "Your document is delivered instantly — download from the page or via email link.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Who We Are</h2>
            <p>
              CertExpress is operated by <strong>NaachTech</strong>, a
              technology company focused on simplifying access to public
              regulatory information for the trucking and transportation
              industry.
            </p>
            <p className="mt-2">
              Questions? Email us at{" "}
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline"
              >
                orders@certexpresss.com
              </a>
              .
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Why carriers use CertExpress
            </h2>
            <p>
              Thousands of motor carriers, brokers, and dispatchers use
              CertExpress to pull FMCSA Certificates of Authority, USDOT
              profiles, and motor-carrier permits on demand — without driving to
              an FMCSA office or waiting on mailed copies. Our searchable index
              covers carriers across every U.S. state, is refreshed daily from
              the public FMCSA release, and delivers each document as a clean,
              broker-ready PDF the instant payment clears.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
