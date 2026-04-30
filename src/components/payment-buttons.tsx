"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STICKY_PAY_EVENT } from "@/components/sticky-pay-bar";

type Gtag = (
  command: "event",
  action: string,
  params?: Record<string, unknown>
) => void;

function track(action: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g === "function") g("event", action, params);
}

export function PaymentButtons({
  companyId,
  termsVersion = "1.0",
  priceDisplay,
  priceCents,
}: {
  companyId: string;
  termsVersion?: string;
  priceDisplay?: string;
  priceCents?: number;
}) {
  const [agreed, setAgreed] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleStripeRef = useRef<() => void>(() => {});

  function requireAgreed() {
    if (!agreed) {
      setShowTermsError(true);
      track("terms_rejected", { company_id: companyId });
      return false;
    }
    return true;
  }

  async function handleStripe() {
    track("pay_button_click", { method: "stripe", company_id: companyId });
    if (!requireAgreed()) return;
    track("begin_checkout", {
      currency: "USD",
      value: typeof priceCents === "number" ? priceCents / 100 : undefined,
      company_id: companyId,
      method: "stripe",
    });
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
    track("pay_button_click", { method: "paypal", company_id: companyId });
    if (!requireAgreed()) return;
    track("begin_checkout", {
      currency: "USD",
      value: typeof priceCents === "number" ? priceCents / 100 : undefined,
      company_id: companyId,
      method: "paypal",
    });
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

  // Suppress unused-function warning while PayPal is hidden
  void handlePayPal;

  // Keep ref in sync so the global listener always calls the latest closure
  handleStripeRef.current = handleStripe;

  // Listen for the sticky mobile bar: it just fires this event; we run the
  // same checkout logic (terms gate + Stripe redirect) here so there is one
  // source of truth.
  useEffect(() => {
    const onStickyClick = () => {
      track("sticky_pay_click", { company_id: companyId });
      handleStripeRef.current();
    };
    window.addEventListener(STICKY_PAY_EVENT, onStickyClick);
    return () => window.removeEventListener(STICKY_PAY_EVENT, onStickyClick);
  }, [companyId]);

  const isLoading = loading === "stripe";

  return (
    <div id="pay-form" className="space-y-3">
      {/* Mandatory consent checkbox */}
      <div
        className={`rounded-lg px-3 py-2 border transition-colors ${
          showTermsError && !agreed
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (e.target.checked) setShowTermsError(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 flex-shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            I agree to the{" "}
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
          &#9888; Please accept the Terms of Service to continue.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleStripe}
        disabled={isLoading}
        className="w-full flex items-center justify-between gap-3 rounded-lg bg-[#635bff] hover:bg-[#5046e5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#635bff] text-white px-5 py-4 font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 text-base">
          <span aria-hidden="true">&#128274;</span>
          {isLoading ? "Redirecting to Stripe…" : "Checkout with Stripe"}
        </span>
        {priceDisplay && !isLoading && (
          <span className="text-base font-bold">${priceDisplay}</span>
        )}
      </button>

      <p className="text-[11px] text-gray-500 text-center">
        Powered by Stripe &middot; Cards, Apple Pay, Google Pay &middot; 256-bit SSL
      </p>

      <p className="text-[11px] text-gray-400 text-center pt-1 leading-relaxed">
        CertExpress is a private service and is not affiliated with FMCSA or
        any government agency.
      </p>
    </div>
  );
}
