import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "Privacy Policy | CertExpress",
};

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">
          Last updated: April 2026 · Operated by NaachTech
        </p>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Who We Are</h2>
            <p>
              CertExpress is a private document delivery service operated by
              NaachTech. We are not affiliated with any government agency.
              Contact: orders@certexpresss.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Email address</strong> — provided by your payment
                processor after purchase, used to deliver your download link
              </li>
              <li>
                <strong>IP address</strong> — collected at checkout for fraud
                prevention and compliance purposes
              </li>
              <li>
                <strong>Order details</strong> — company name, document type,
                amount paid, download activity (count and timestamps)
              </li>
              <li>
                <strong>Payment information</strong> — processed entirely by
                Stripe or PayPal. We never see or store your card details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Sending your download link and order confirmation email</li>
              <li>Processing and tracking your order</li>
              <li>Fraud prevention and dispute resolution</li>
              <li>Accounting and legal compliance</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell, rent, or share your personal
              data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Processors</h2>
            <p>Your payment is processed by:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong>Stripe, Inc.</strong> —{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  stripe.com/privacy
                </a>
              </li>
              <li>
                <strong>PayPal, Inc.</strong> —{" "}
                <a
                  href="https://www.paypal.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  paypal.com/privacy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              Order records (email, IP, download history) are retained for
              accounting and legal compliance purposes. To request deletion of
              your email address, contact us at{" "}
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline"
              >
                orders@certexpresss.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies</h2>
            <p>
              We use only functional cookies necessary for session management.
              We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your
              personal data by emailing{" "}
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline"
              >
                orders@certexpresss.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact</h2>
            <p>
              For privacy-related inquiries, contact:{" "}
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline"
              >
                orders@certexpresss.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
