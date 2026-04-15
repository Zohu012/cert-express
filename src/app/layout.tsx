import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertExpress - FMCSA Certificate Delivery",
  description:
    "Get your FMCSA Certificate of Authority delivered instantly. Search by USDOT Number, MC/MX Number, or Company Name.",
  icons: {
    icon: "/logo_icon.png",
    shortcut: "/logo_icon.png",
    apple: "/logo_icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
