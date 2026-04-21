import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/pay",
          "/pay/",
          "/success",
          "/cancel",
          "/download",
          "/unsubscribe",
          "/resubscribe",
          "/search",
        ],
      },
    ],
    sitemap: "https://www.certexpresss.com/sitemap.xml",
    host: "https://www.certexpresss.com",
  };
}
