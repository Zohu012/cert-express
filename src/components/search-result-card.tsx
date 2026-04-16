"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PreviewModal } from "@/components/preview-modal";

type Company = {
  id: string;
  companyName: string;
  dbaName: string | null;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: string; // pre-formatted
  city: string | null;
  state: string | null;
  previewFilename: string | null;
};

export function SearchResultCard({
  company,
  priceDisplay,
}: {
  company: Company;
  priceDisplay: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const previewUrl = company.previewFilename
    ? `/api/previews/${company.previewFilename}`
    : null;

  return (
    <>
      <Card className="hover:shadow-md transition">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
          {/* Left: company details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900">
              {company.companyName}
            </h3>
            {company.dbaName && (
              <p className="text-sm text-gray-500">D/B/A {company.dbaName}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
              <span>
                <strong>DOT:</strong> {company.usdotNumber}
              </span>
              <span>
                <strong>{company.documentType}:</strong>{" "}
                {company.documentNumber}
              </span>
              <span>
                <strong>Date:</strong> {company.serviceDate}
              </span>
              {company.city && company.state && (
                <span>
                  {company.city}, {company.state}
                </span>
              )}
            </div>
          </div>

          {/* Middle: preview image */}
          {previewUrl && (
            <div className="flex-shrink-0 w-full lg:w-40">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="relative group block w-full lg:w-40 rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="w-full transition-transform duration-200 group-hover:scale-105"
                />
                {/* Hover overlay */}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    Preview Document
                  </span>
                </span>
              </button>
              <p className="text-xs text-gray-400 text-center mt-1.5 hidden lg:block">
                Click to preview
              </p>
            </div>
          )}

          {/* Right: CTA + trust */}
          <div className="flex-shrink-0 lg:w-48 flex flex-col items-center lg:items-end gap-2">
            <Link
              href={`/pay/${company.id}`}
              className="w-full lg:w-auto inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition whitespace-nowrap"
            >
              Get Your PDF Instantly
            </Link>
            <p className="text-sm font-medium text-gray-600">
              {priceDisplay} · Instant delivery
            </p>
            <div className="hidden lg:flex flex-col gap-1 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <span className="text-green-600">&#10003;</span> Matches your
                FMCSA record
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">&#10003;</span> Ready for
                onboarding &amp; brokers
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600">&#10003;</span> Secure checkout
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview modal */}
      {modalOpen && previewUrl && (
        <PreviewModal
          previewUrl={previewUrl}
          companyName={company.companyName}
          documentNumber={company.documentNumber}
          serviceDate={company.serviceDate}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
