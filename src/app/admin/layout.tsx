import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Allow login page to render without auth
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xl font-bold">
              CertExpress Admin
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link
                href="/admin"
                className="text-gray-300 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/upload"
                className="text-gray-300 hover:text-white transition"
              >
                Upload PDF
              </Link>
              <Link
                href="/admin/companies"
                className="text-gray-300 hover:text-white transition"
              >
                Companies
              </Link>
              <Link
                href="/admin/emails"
                className="text-gray-300 hover:text-white transition"
              >
                Emails
              </Link>
              <Link
                href="/admin/settings"
                className="text-gray-300 hover:text-white transition"
              >
                Settings
              </Link>
            </nav>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            View Site
          </Link>
        </div>
      </header>
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}
