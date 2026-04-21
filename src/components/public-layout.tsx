import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "@/components/site-nav";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Brand column */}
            <div className="md:col-span-1">
              <Link href="/" className="inline-block">
                <Image
                  src="/logo.png"
                  alt="CertExpress"
                  width={240}
                  height={70}
                  className="h-14 w-auto object-contain"
                />
              </Link>
              <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                Instant delivery of FMCSA Certificates of Authority.
                A private document-assistance service.
              </p>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Company
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/companies" className="hover:text-white">Companies</Link></li>
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Legal
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/refund" className="hover:text-white">Refund Policy</Link></li>
                <li><Link href="/impressum" className="hover:text-white">Impressum</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Contact
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:orders@certexpresss.com"
                    className="hover:text-white break-all"
                  >
                    orders@certexpresss.com
                  </a>
                </li>
                <li className="text-gray-400">
                  Operated by NaachTech
                </li>
              </ul>
            </div>
          </div>

          {/* Disclaimer band */}
          <div className="mt-10 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-400 text-center max-w-3xl mx-auto leading-relaxed">
              <strong className="text-gray-300">CertExpress is a private service</strong> and
              is not affiliated with the FMCSA, U.S. Department of Transportation,
              or any government agency. We provide assistance in accessing publicly
              available documents.
            </p>
            <p className="mt-3 text-xs text-gray-500 text-center">
              &copy; {new Date().getFullYear()} CertExpress, operated by NaachTech. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
