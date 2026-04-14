import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <ResultLayout>
        <Card className="text-center py-10">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-500">No download token provided.</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
            Go to homepage
          </Link>
        </Card>
      </ResultLayout>
    );
  }

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { company: true },
  });

  if (!order || order.status !== "completed") {
    return (
      <ResultLayout>
        <Card className="text-center py-10">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Order Not Found
          </h1>
          <p className="text-gray-500">
            This payment may still be processing. Please check your email for
            the download link.
          </p>
          <Link href="/" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
            Go to homepage
          </Link>
        </Card>
      </ResultLayout>
    );
  }

  return (
    <ResultLayout>
      <Card className="text-center py-10">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-green-700 mb-2">
          Payment Successful!
        </h1>
        <p className="text-gray-600 mb-6">
          Your certificate for <strong>{order.company.companyName}</strong> is
          ready to download.
        </p>

        <a href={`/download/${order.downloadToken}`}>
          <Button className="!px-8 !py-3 !text-base">
            Download Certificate (PDF)
          </Button>
        </a>

        <p className="text-xs text-gray-400 mt-4">
          You can download this file up to {order.maxDownloads} times. A
          download link has also been sent to your email.
        </p>
      </Card>
    </ResultLayout>
  );
}

function ResultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            CertExpress
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="max-w-md w-full">{children}</div>
      </main>
    </div>
  );
}
