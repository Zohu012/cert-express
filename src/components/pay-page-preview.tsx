"use client";

import { useState } from "react";
import { PreviewModal } from "@/components/preview-modal";

export function PayPagePreview({
  previewUrl,
  companyName,
  documentNumber,
  serviceDate,
}: {
  previewUrl: string;
  companyName: string;
  documentNumber: string;
  serviceDate: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-2 font-medium">
          Preview of your FMCSA document
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="relative group block w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-pointer bg-gray-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Document preview for ${companyName}`}
            className="w-full h-auto block transition-transform duration-200 group-hover:scale-[1.01]"
          />
          <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-white/90 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg shadow">
              View Full Preview
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
        >
          View full preview
        </button>
      </div>

      {modalOpen && (
        <PreviewModal
          previewUrl={previewUrl}
          companyName={companyName}
          documentNumber={documentNumber}
          serviceDate={serviceDate}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
