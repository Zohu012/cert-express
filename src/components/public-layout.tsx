import Link from "next/link";
import Image from "next/image";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-900">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="CertExpress"
              width={280}
              height={80}
              className="h-16 w-auto object-contain"
              priority
            />
          </Link>
          <p className="text-blue-200 text-sm hidden sm:block">
            FMCSA Document Delivery Service
          </p>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t pt-8 pb-6">
        <div className="max-w-6xl mx-auto px-4">
          {/* Logo in footer */}
          <div className="flex justify-center mb-5">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="CertExpress"
                width={140}
                height={42}
                className="h-10 w-auto object-contain bg-blue-900 rounded-lg px-2 py-1"
              />
            </Link>
          </div>

          {/* Mandatory disclaimer */}
          <div className="mb-5 text-center">
            <p className="text-sm font-semibold text-gray-700 max-w-2xl mx-auto">
              CertExpress is a private service and is not affiliated with any
              government agency. We provide assistance in accessing publicly
              available documents.
            </p>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-blue-600 mb-5">
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/faq" className="hover:underline">FAQ</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/refund" className="hover:underline">Refund Policy</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
            <Link href="/impressum" className="hover:underline">Impressum</Link>
          </nav>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>Email: support@certexpresss.com</p>
            <p>
              &copy; {new Date().getFullYear()} CertExpress, operated by
              NaachTech. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
