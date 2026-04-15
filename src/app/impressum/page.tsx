import { PublicLayout } from "@/components/public-layout";

export const metadata = {
  title: "Impressum | CertExpress",
};

export default function ImpressumPage() {
  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Impressum</h1>
        <p className="text-gray-500 mb-8">Legal Disclosure</p>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Service Provider
            </h2>
            <p className="font-medium">NaachTech</p>
            <p>Operating as: CertExpress</p>
          </section>

          <hr className="border-gray-100" />

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact</h2>
            <p>
              Email:{" "}
              <a
                href="mailto:orders@certexpresss.com"
                className="text-blue-600 hover:underline"
              >
                orders@certexpresss.com
              </a>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Address and phone number available upon written request.
            </p>
          </section>

          <hr className="border-gray-100" />

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Content Responsibility
            </h2>
            <p className="text-sm">
              Responsible for content: NaachTech (operator of CertExpress)
            </p>
          </section>

          <hr className="border-gray-100" />

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Disclaimer
            </h2>
            <p className="text-sm">
              CertExpress is a <strong>private service</strong> and is{" "}
              <strong>not affiliated</strong> with FMCSA, the US Department of
              Transportation, or any government agency. Documents delivered
              through this service are publicly available records. You are
              purchasing a document retrieval and delivery service, not the
              document itself.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
