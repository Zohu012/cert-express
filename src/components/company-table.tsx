"use client";

import { useState } from "react";

interface Company {
  id: string;
  companyName: string;
  dbaName: string | null;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: Date;
  city: string | null;
  state: string | null;
  email: string | null;
  emailStatus: string | null;
  pdfFilename: string | null;
}

function formatDate(date: Date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function CompanyTable({ companies }: { companies: Company[] }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-600">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">DOT#</th>
            <th className="px-4 py-3">Document</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">PDF</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <CompanyRow key={c.id} company={c} />
          ))}
        </tbody>
      </table>
      {companies.length === 0 && (
        <p className="text-center py-8 text-gray-400">No companies found</p>
      )}
    </div>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const [email, setEmail] = useState(company.email || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState(company.emailStatus);

  async function saveEmail() {
    setSaving(true);
    await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: company.id, email }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendEmail() {
    if (!email) return;
    setSending(true);
    setSendResult(null);
    try {
      // Save email first if changed
      await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, email }),
      });
      // Send email
      const res = await fetch("/api/admin/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: [company.id] }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        setSendResult("Sent!");
        setEmailStatus("sent");
      } else {
        setSendResult("Failed");
        setEmailStatus("failed");
      }
    } catch {
      setSendResult("Error");
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 3000);
  }

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="px-4 py-2">
        <div className="font-medium">{company.companyName}</div>
        {company.dbaName && (
          <div className="text-xs text-gray-400">D/B/A {company.dbaName}</div>
        )}
      </td>
      <td className="px-4 py-2">{company.usdotNumber}</td>
      <td className="px-4 py-2 font-mono text-xs">{company.documentNumber}</td>
      <td className="px-4 py-2">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            company.documentType === "CERTIFICATE"
              ? "bg-blue-100 text-blue-800"
              : company.documentType === "PERMIT"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {company.documentType}
        </span>
      </td>
      <td className="px-4 py-2 text-gray-600">
        {formatDate(company.serviceDate)}
      </td>
      <td className="px-4 py-2 text-gray-600">
        {company.city}, {company.state}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            className="w-44 rounded border px-2 py-1 text-xs"
          />
          <button
            onClick={saveEmail}
            disabled={saving}
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saved ? "Saved" : saving ? "..." : "Save"}
          </button>
          <button
            onClick={sendEmail}
            disabled={sending || !email}
            className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            title="Send offer email to this company"
          >
            {sending ? "..." : sendResult || "Send"}
          </button>
        </div>
        {emailStatus && (
          <span
            className={`text-xs mt-0.5 block ${
              emailStatus === "sent"
                ? "text-green-600"
                : emailStatus === "failed"
                  ? "text-red-500"
                  : "text-gray-400"
            }`}
          >
            {emailStatus}
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {company.pdfFilename && (
          <a
            href={`/pdfs/${company.pdfFilename}`}
            target="_blank"
            className="text-blue-600 hover:underline text-xs"
          >
            View
          </a>
        )}
      </td>
    </tr>
  );
}
