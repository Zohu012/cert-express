"use client";

import { useEffect, useState } from "react";
import { PaymentButtons } from "@/components/payment-buttons";

export function StickyPayBar({
  companyId,
  termsVersion,
  priceDisplay,
  priceCents,
  initialPriceDisplay,
  savingsDisplay,
}: {
  companyId: string;
  termsVersion?: string;
  priceDisplay: string;
  priceCents: number;
  initialPriceDisplay?: string | null;
  savingsDisplay?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      {expanded && (
        <button
          type="button"
          aria-label="Close checkout"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-40 bg-black/50"
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-2xl ${
          expanded ? "rounded-t-2xl" : ""
        }`}
      >
        {expanded ? (
          <div className="max-h-[88vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse checkout"
              className="w-full flex flex-col items-center pt-2 pb-1 text-gray-400 hover:text-gray-600"
            >
              <span className="block w-10 h-1 rounded-full bg-gray-300 mb-1" />
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="px-4 pb-5">
              <PaymentButtons
                companyId={companyId}
                termsVersion={termsVersion}
                priceDisplay={priceDisplay}
                priceCents={priceCents}
                initialPriceDisplay={initialPriceDisplay}
                savingsDisplay={savingsDisplay}
              />
            </div>
          </div>
        ) : (
          <div className="p-3 flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 leading-none">
                One-time
              </div>
              <div className="text-lg font-bold text-gray-900 leading-tight">
                ${priceDisplay}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex-1 bg-[#635bff] hover:bg-[#5046e5] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-sm"
            >
              <span aria-hidden="true">&#128274;</span>
              Checkout with Stripe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
