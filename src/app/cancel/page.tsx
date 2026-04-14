import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
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
        <div className="max-w-md w-full">
          <Card className="text-center py-10">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Payment Cancelled
            </h1>
            <p className="text-gray-500 mb-6">
              Your payment was cancelled. No charges were made.
            </p>
            <Link href="/">
              <Button variant="secondary">Back to Search</Button>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
