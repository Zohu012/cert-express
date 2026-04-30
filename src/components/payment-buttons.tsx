"use client";

import { useState } from "react";
import Link from "next/link";

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
  initialPriceDisplay,
  savingsDisplay,
}: {
  companyId: string;
  termsVersion?: string;
  priceDisplay?: string;
  priceCents?: number;
  initialPriceDisplay?: string | null;
  savingsDisplay?: string | null;
}) {
  const [agreed, setAgreed] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const isLoading = loading === "stripe";

  return (
    <div id="pay-form" className="space-y-4">
      {/* Pricing */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">
          One-time payment &middot; Total today
        </p>
        <div className="mt-1 flex items-baseline flex-wrap gap-x-3 gap-y-1">
          <p className="text-3xl font-bold text-gray-900">
            ${priceDisplay}
          </p>
          {initialPriceDisplay && (
            <p className="text-base font-semibold text-gray-400 line-through">
              ${initialPriceDisplay}
            </p>
          )}
          {savingsDisplay && (
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Save ${savingsDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Trust bullets */}
      <ul className="space-y-1.5 text-sm text-gray-700">
        <li className="flex items-start gap-2">
          <span className="text-green-600 mt-0.5">&#10003;</span>
          <span>Instant PDF download after payment</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-600 mt-0.5">&#10003;</span>
          <span>Encrypted checkout via Stripe &mdash; we never see your card</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-600 mt-0.5">&#10003;</span>
          <Link href="/refund" target="_blank" className="hover:underline">
            30-day money-back guarantee
          </Link>
        </li>
      </ul>

      {/* Terms checkbox */}
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

      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
        CertExpress is a private service and is not affiliated with FMCSA or
        any government agency.
      </p>
    </div>
  );
}
