import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.certexpresss.com"),
  title: "CertExpress - FMCSA Certificate Delivery",
  description:
    "Get your FMCSA Certificate of Authority delivered instantly. Search by USDOT Number, MC/MX Number, or Company Name.",
  icons: {
    icon: [
      { url: "/logo_icon.png", type: "image/png", sizes: "any" },
    ],
    shortcut: [{ url: "/logo_icon.png", type: "image/png" }],
    apple: [{ url: "/logo_icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "CertExpress - FMCSA Certificate Delivery",
    description:
      "Get your FMCSA Certificate of Authority delivered instantly.",
    images: ["/logo_icon.png"],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-X8TYG1H11N"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-X8TYG1H11N');
        `}</Script>
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
