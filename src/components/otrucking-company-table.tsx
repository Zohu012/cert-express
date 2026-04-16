"use client";

import { useState } from "react";

interface OtruckingCompany {
  id: string;
  usdotNumber: string;
  sourceUrl: string | null;
  companyName: string | null;
  physicalAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  companyOfficer: string | null;
  dotStatus: string | null;
  entityType: string | null;
  estYear: string | null;
  powerUnits: string | null;
  drivers: string | null;
  safetyRating: string | null;
  authorityStatus: string | null;
  authoritySince: string | null;
  carrierType: string | null;
  hazmat: string | null;
  passengerCarrier: string | null;
  mcs150Update: string | null;
  county: string | null;
  fleetBreakdown: string | null;
  cargoTypes: string | null;
  equipmentTypes: string | null;
  scrapeStatus: string;
  scrapeError: string | null;
  scrapedAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-green-100 text-green-800"
      : status === "not_found"
        ? "bg-yellow-100 text-yellow-800"
        : status === "error"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function parseJsonSafe(s: string | null): string[] {
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

export function OtruckingCompanyTable({ companies }: { companies: OtruckingCompany[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left whitespace-nowrap">
            <th className="px-4 py-3 text-gray-600">Company</th>
            <th className="px-4 py-3 text-gray-600">DOT#</th>
            <th className="px-4 py-3 text-gray-600">Email</th>
            <th className="px-4 py-3 text-gray-600">Phone</th>
            <th className="px-4 py-3 text-gray-600">Status</th>
            <th className="px-4 py-3 text-gray-600">Power Units</th>
            <th className="px-4 py-3 text-gray-600">Cargo Types</th>
            <th className="px-4 py-3 text-gray-600">Scrape</th>
            <th className="px-4 py-3 text-gray-600">Scraped At</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <>
              <tr
                key={c.id}
                className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <td className="px-4 py-2 font-medium">{c.companyName || "-"}</td>
                <td className="px-4 py-2">{c.usdotNumber}</td>
                <td className="px-4 py-2">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline text-xs">
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">{c.phone || "-"}</td>
                <td className="px-4 py-2">{c.dotStatus || "-"}</td>
                <td className="px-4 py-2">{c.powerUnits || "-"}</td>
                <td className="px-4 py-2 text-xs max-w-[200px] truncate">
                  {parseJsonSafe(c.cargoTypes).join(", ") || "-"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.scrapeStatus} />
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{formatDate(c.scrapedAt)}</td>
              </tr>
              {expandedId === c.id && (
                <tr key={`${c.id}-detail`} className="bg-gray-50">
                  <td colSpan={9} className="px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Officer:</span>{" "}
                        <span className="font-medium">{c.companyOfficer || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Entity:</span>{" "}
                        <span className="font-medium">{c.entityType || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Carrier Type:</span>{" "}
                        <span className="font-medium">{c.carrierType || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Est:</span>{" "}
                        <span className="font-medium">{c.estYear || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Authority Since:</span>{" "}
                        <span className="font-medium">{c.authoritySince || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Safety Rating:</span>{" "}
                        <span className="font-medium">{c.safetyRating || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Hazmat:</span>{" "}
                        <span className="font-medium">{c.hazmat || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Passenger:</span>{" "}
                        <span className="font-medium">{c.passengerCarrier || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">MCS-150:</span>{" "}
                        <span className="font-medium">{c.mcs150Update || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">County:</span>{" "}
                        <span className="font-medium">{c.county || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Drivers:</span>{" "}
                        <span className="font-medium">{c.drivers || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Address:</span>{" "}
                        <span className="font-medium">
                          {[c.physicalAddress, c.city, c.state, c.zipCode].filter(Boolean).join(", ") || "-"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Equipment:</span>{" "}
                        <span className="font-medium">{parseJsonSafe(c.equipmentTypes).join(", ") || "-"}</span>
                      </div>
                      {c.sourceUrl && (
                        <div className="col-span-2">
                          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View on otrucking.com
                          </a>
                        </div>
                      )}
                      {c.scrapeError && (
                        <div className="col-span-4 text-red-600">
                          Error: {c.scrapeError}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {companies.length === 0 && (
        <p className="text-center py-8 text-gray-400">No otrucking companies found</p>
      )}
    </div>
  );
}
