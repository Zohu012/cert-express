import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.certexpresss.com"),
  title: {
    default: "CertExpress — FMCSA Certificate of Authority Delivery",
    template: "%s | CertExpress",
  },
  description:
    "Get your FMCSA Certificate of Authority delivered instantly. Search by USDOT Number, MC/MX Number, or Company Name. Secure payment, instant PDF download.",
  keywords: [
    "FMCSA certificate of authority",
    "USDOT certificate",
    "MC number certificate",
    "trucking authority document",
    "DOT number lookup",
    "motor carrier certificate",
    "FMCSA document download",
    "CertExpress",
  ],
  icons: {
    icon: [{ url: "/logo_icon.png", type: "image/png", sizes: "any" }],
    shortcut: [{ url: "/logo_icon.png", type: "image/png" }],
    apple: [{ url: "/logo_icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "CertExpress — FMCSA Certificate of Authority Delivery",
    description:
      "Instant, secure delivery of FMCSA Certificates of Authority. Search by USDOT, MC/MX, or carrier name.",
    images: ["/logo_icon.png"],
    siteName: "CertExpress",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CertExpress — FMCSA Certificate of Authority Delivery",
    description:
      "Instant, secure delivery of FMCSA Certificates of Authority.",
    images: ["/logo_icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CertExpress",
    url: "https://www.certexpresss.com",
    logo: "https://www.certexpresss.com/logo.png",
    description:
      "Private document-retrieval service that delivers FMCSA Certificates of Authority, Permits, and Licenses as instant PDF downloads.",
    email: "orders@certexpresss.com",
    sameAs: [] as string[],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CertExpress",
    url: "https://www.certexpresss.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate:
          "https://www.certexpresss.com/?type=dot&q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
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
