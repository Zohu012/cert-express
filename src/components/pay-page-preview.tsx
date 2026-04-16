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
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-2 font-medium text-center">
          Preview of your FMCSA document
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="relative group block w-full max-w-md mx-auto rounded-lg overflow-hidden border border-gray-200 shadow cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Document preview for ${companyName}`}
            className="w-full transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-white/90 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg shadow">
              View Full Preview
            </span>
          </span>
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
