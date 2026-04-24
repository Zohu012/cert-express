import { ImageResponse } from "next/og";

export const alt = "FMCSA Carrier Profile — CertExpress";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ usdotNumber: string }>;
}) {
  const { usdotNumber } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "white",
            }}
          >
            C
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            CertExpress
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#bfdbfe",
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            FMCSA Carrier Profile
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {`USDOT ${usdotNumber}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#dbeafe",
              maxWidth: 960,
              lineHeight: 1.3,
            }}
          >
            View authority status, fleet data, and request the official Certificate of Authority PDF.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#93c5fd",
          }}
        >
          <div style={{ display: "flex" }}>certexpresss.com</div>
          <div style={{ display: "flex" }}>Instant PDF delivery</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
