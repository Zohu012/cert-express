"use client";

import { useEffect, useState } from "react";

/** Shared event name — dispatched by the sticky bar, handled by PaymentButtons
 *  so the sticky CTA reuses the exact same terms-check + Stripe redirect flow. */
export const STICKY_PAY_EVENT = "certexpress:sticky-pay-click";

export function StickyPayBar({ priceDisplay }: { priceDisplay: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleClick() {
    // Scroll the pay form into view so the user can see the terms checkbox
    // (or any error it throws), then fire the shared checkout event.
    const form = document.getElementById("pay-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent(STICKY_PAY_EVENT));
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 p-3 shadow-lg flex items-center gap-3">
      <div className="flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 leading-none">
          One-time
        </div>
        <div className="text-lg font-bold text-green-700 leading-tight">
          ${priceDisplay}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-sm"
      >
        Get PDF Copy
      </button>
    </div>
  );
}
