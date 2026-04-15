"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaymentButtons({
  companyId,
  termsVersion = "1.0",
}: {
  companyId: string;
  termsVersion?: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requireAgreed() {
    if (!agreed) { setShowTermsError(true); return false; }
    return true;
  }

  async function handleStripe() {
    if (!requireAgreed()) return;
    setLoading("stripe");
    setError(null);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          termsAcceptedAt: new Date().toISOString(),
          termsVersion,
        }),
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
    if (!requireAgreed()) return;
    setLoading("paypal");
    setError(null);
    try {
      const res = await fetch("/api/checkout/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          termsAcceptedAt: new Date().toISOString(),
          termsVersion,
        }),
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
    <div className="space-y-4">
      {/* Mandatory consent checkbox */}
      <div className={`bg-gray-50 rounded-lg p-4 border-2 transition-colors ${
        showTermsError && !agreed ? "border-red-500" : "border-transparent"
      }`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setShowTermsError(false); }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            I have read and agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/refund"
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              Refund Policy
            </Link>
            .
          </span>
        </label>
      </div>

      {showTermsError && !agreed && (
        <p className="text-sm font-medium text-center text-red-600">
          ⚠ Please accept the Terms of Service to continue.
        </p>
      )}

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
        className="w-full !py-3 !text-base !bg-yellow-400 !text-black hover:!bg-yellow-500 disabled:!opacity-50"
      >
        {loading === "paypal" ? "Redirecting..." : "Pay with PayPal"}
      </Button>

      <p className="text-xs text-gray-400 text-center mt-2">
        Secure payment processing. Your document will be available for
        download immediately after payment.
      </p>

      <p className="text-xs text-gray-400 text-center">
        CertExpress is a private service and is not affiliated with FMCSA or
        any government agency.
      </p>
    </div>
  );
}
