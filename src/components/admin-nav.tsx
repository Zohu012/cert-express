"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/upload", label: "Upload PDF" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/otrucking-companies", label: "Otrucking" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="text-xl font-bold"
            onClick={() => setOpen(false)}
          >
            CertExpress Admin
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-gray-300 hover:text-white transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            View Site
          </Link>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Log Out
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav-panel"
          aria-label="Toggle navigation"
          className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-gray-300 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {open ? (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div
          id="admin-mobile-nav-panel"
          className="md:hidden border-t border-gray-800 bg-gray-900"
        >
          <nav className="px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 border-t border-gray-800" />
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              View Site
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Log Out
              </button>
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
