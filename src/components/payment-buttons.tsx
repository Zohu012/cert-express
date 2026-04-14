"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PaymentButtons({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStripe() {
    setLoading("stripe");
    setError(null);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePayPal() {
    setLoading("paypal");
    setError(null);
    try {
      const res = await fetch("/api/checkout/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        setError(data.error || "Failed to create PayPal order");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        onClick={handleStripe}
        disabled={loading !== null}
        className="w-full !py-3 !text-base"
      >
        {loading === "stripe" ? "Redirecting..." : "Pay with Card (Stripe)"}
      </Button>

      <Button
        onClick={handlePayPal}
        disabled={loading !== null}
        variant="secondary"
        className="w-full !py-3 !text-base !bg-yellow-400 !text-black hover:!bg-yellow-500"
      >
        {loading === "paypal" ? "Redirecting..." : "Pay with PayPal"}
      </Button>

      <p className="text-xs text-gray-400 text-center mt-4">
        Secure payment processing. Your certificate will be available for
        download immediately after payment.
      </p>
    </div>
  );
}
