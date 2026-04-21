"use client";

import { useEffect, useState } from "react";

export function StickyPayBar({ priceDisplay }: { priceDisplay: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <a
        href="#pay-form"
        className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-sm"
      >
        Get PDF Copy
      </a>
    </div>
  );
}
