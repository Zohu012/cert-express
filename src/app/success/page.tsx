import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center py-10 px-4">
          <div className="max-w-md w-full">
            <Card className="text-center py-10">
              <h1 className="text-2xl font-bold text-red-600 mb-2">
                Invalid Link
              </h1>
              <p className="text-gray-500">No download token provided.</p>
              <Link href="/" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
                Go to homepage
              </Link>
            </Card>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { company: true },
  });

  if (!order || order.status !== "completed") {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center py-10 px-4">
          <div className="max-w-md w-full">
            <Card className="text-center py-10">
              <h1 className="text-2xl font-bold text-red-600 mb-2">
                Order Not Found
              </h1>
              <p className="text-gray-500">
                This payment may still be processing. Please check your email
                for the download link.
              </p>
              <Link href="/" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
                Go to homepage
              </Link>
            </Card>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const priceDisplay = `$${(order.amount / 100).toFixed(2)}`;

  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="max-w-md w-full">
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
            <p className="text-gray-600 mb-4">
              Your document is ready to download.
            </p>

            {/* Order summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Company</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">
                    {order.company.companyName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Document Type</span>
                  <span className="font-medium text-gray-900">
                    {order.company.documentType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-medium text-green-700">{priceDisplay}</span>
                </div>
              </div>
            </div>

            <a href={`/download/${order.downloadToken}`}>
              <Button className="!px-8 !py-3 !text-base w-full">
                ⬇ Download Document (PDF)
              </Button>
            </a>

            <div className="mt-4 space-y-1">
              <p className="text-xs text-gray-400">
                You can download this file up to {order.maxDownloads} times
                within 72 hours.
              </p>
              <p className="text-xs text-gray-400">
                A confirmation email with your download link has been sent to
                your email address.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
