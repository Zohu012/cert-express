"use client";

import { useEffect, useCallback } from "react";

export function PreviewModal({
  previewUrl,
  companyName,
  documentNumber,
  serviceDate,
  onClose,
}: {
  previewUrl: string;
  companyName: string;
  documentNumber: string;
  serviceDate: string;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
          aria-label="Close preview"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Preview image */}
        <div className="p-4 pb-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Document preview for ${companyName}`}
            className="w-full rounded-lg border border-gray-200"
          />
        </div>

        {/* Document details */}
        <div className="p-4 pt-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mb-3">
            <span><strong>Company:</strong> {companyName}</span>
            <span><strong>Document:</strong> {documentNumber}</span>
            <span><strong>Date:</strong> {serviceDate}</span>
          </div>

          <div className="text-center pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500 mt-2">
              Pay to unlock and download the full document.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
