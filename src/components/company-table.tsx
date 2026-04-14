"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [rows, setRows] = useState<Company[]>(companies);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/admin/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setRows((prev) => prev.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
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
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                onDelete={(id) => { setDeleteId(id); setDeleteError(""); }}
                onUpdated={(updated) =>
                  setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
                }
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center py-8 text-gray-400">No companies found</p>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Delete Company?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the company record, its PDF file, and
              all associated orders. This cannot be undone.
            </p>
            {deleteError && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CompanyRow({
  company,
  onDelete,
  onUpdated,
}: {
  company: Company;
  onDelete: (id: string) => void;
  onUpdated: (c: Company) => void;
}) {
  const [email, setEmail] = useState(company.email || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState(company.emailStatus);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [hasPdf, setHasPdf] = useState(!!company.pdfFilename);
  const fileRef = useRef<HTMLInputElement>(null);

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
      await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, email }),
      });
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

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("id", company.id);
      fd.append("pdf", file);
      const res = await fetch("/api/admin/companies", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setHasPdf(true);
      setUploadMsg("Replaced!");
      onUpdated({ ...company, pdfFilename: data.pdfFilename });
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(null), 3000);
      if (fileRef.current) fileRef.current.value = "";
    }
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
      <td className="px-4 py-2 text-gray-600">{formatDate(company.serviceDate)}</td>
      <td className="px-4 py-2 text-gray-600">
        {company.city}, {company.state}
      </td>

      {/* Email column */}
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
            {saved ? "Saved" : saving ? "…" : "Save"}
          </button>
          <button
            onClick={sendEmail}
            disabled={sending || !email}
            className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            title="Send offer email"
          >
            {sending ? "…" : sendResult || "Send"}
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

      {/* PDF column — View via authenticated API route */}
      <td className="px-4 py-2">
        <div className="flex flex-col gap-1">
          {hasPdf ? (
            <a
              href={`/api/admin/pdf/${company.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              View
            </a>
          ) : (
            <span className="text-gray-400 text-xs">No PDF</span>
          )}
          {/* Reupload */}
          <label
            className={`text-xs cursor-pointer px-2 py-0.5 rounded border text-center ${
              uploading
                ? "text-gray-400 border-gray-200"
                : "text-orange-700 border-orange-300 hover:bg-orange-50"
            }`}
            title="Replace PDF for this company"
          >
            {uploading ? "…" : uploadMsg || "Replace"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </td>

      {/* Actions column */}
      <td className="px-4 py-2">
        <button
          onClick={() => onDelete(company.id)}
          className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
