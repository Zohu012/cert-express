import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertExpress - FMCSA Certificate Delivery",
  description:
    "Get your FMCSA Certificate of Authority delivered instantly. Search by USDOT Number, MC/MX Number, or Company Name.",
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
