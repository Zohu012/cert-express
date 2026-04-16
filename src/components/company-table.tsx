"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Company {
  id: string;
  companyName: string;
  dbaName: string | null;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: Date;
  createdAt: Date;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  email: string | null;
  emailStatus: string | null;
  pdfFilename: string | null;
}

function formatDate(date: Date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ─── Sort helpers ────────────────────────────────────────────────────────────

interface SortProps {
  sortBy: string;
  sortDir: "asc" | "desc";
  query: string;
  dateFilter: string;
  emailFilter: string;
  page: number;
}

function sortUrl(col: string, current: SortProps) {
  // Toggle dir when clicking the active column; default to asc for a new column
  const dir =
    current.sortBy === col && current.sortDir === "asc" ? "desc" : "asc";
  // Always emit sort + dir so the server never has to guess
  const p: Record<string, string> = { sort: col, dir, page: "1" };
  if (current.query)       p.q     = current.query;
  if (current.dateFilter)  p.date  = current.dateFilter;
  if (current.emailFilter) p.email = current.emailFilter;
  return (
    "/admin/companies?" +
    Object.entries(p)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&")
  );
}

function SortHeader({
  col,
  label,
  sort,
  className = "",
}: {
  col: string;
  label: string;
  sort: SortProps;
  className?: string;
}) {
  const active = sort.sortBy === col;
  const icon = active
    ? sort.sortDir === "asc"
      ? " ↑"
      : " ↓"
    : " ↕";

  return (
    <th className={`px-4 py-3 ${className}`}>
      <Link
        href={sortUrl(col, sort)}
        className={`inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors ${
          active ? "text-blue-700 font-semibold" : "text-gray-600"
        }`}
      >
        {label}
        <span className={`text-xs ${active ? "text-blue-500" : "text-gray-400"}`}>{icon}</span>
      </Link>
    </th>
  );
}

// ─── Edit form state ────────────────────────────────────────────────────────
interface EditForm {
  companyName: string;
  dbaName: string;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: string;   // YYYY-MM-DD
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
}

function companyToForm(c: Company): EditForm {
  return {
    companyName:    c.companyName,
    dbaName:        c.dbaName        || "",
    usdotNumber:    c.usdotNumber,
    documentNumber: c.documentNumber,
    documentType:   c.documentType,
    serviceDate:    formatDate(c.serviceDate),
    streetAddress:  c.streetAddress  || "",
    city:           c.city           || "",
    state:          c.state          || "",
    zipCode:        c.zipCode        || "",
    email:          c.email          || "",
  };
}

// ─── CompanyTable ────────────────────────────────────────────────────────────
export function CompanyTable({
  companies,
  sortBy = "createdAt",
  sortDir = "desc",
  query = "",
  dateFilter = "",
  emailFilter = "",
  page = 1,
  scrapedEmailMap = {},
}: {
  companies: Company[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  query?: string;
  dateFilter?: string;
  emailFilter?: string;
  page?: number;
  scrapedEmailMap?: Record<string, string>;
}) {
  const sort: SortProps = { sortBy, sortDir, query, dateFilter, emailFilter, page };
  const router = useRouter();
  const [rows, setRows] = useState<Company[]>(companies);
  // Sync rows whenever the server sends fresh data (e.g. after sort/filter navigation)
  useEffect(() => { setRows(companies); }, [companies]);

  // Delete state
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Edit state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState("");

  function openEdit(company: Company) {
    setEditingCompany(company);
    setEditForm(companyToForm(company));
    setEditError("");
  }

  function updateField(key: keyof EditForm, value: string) {
    setEditForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!editingCompany || !editForm) return;
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCompany.id, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const updated: Company = {
        ...editingCompany,
        companyName:    editForm.companyName,
        dbaName:        editForm.dbaName    || null,
        usdotNumber:    editForm.usdotNumber,
        documentNumber: editForm.documentNumber,
        documentType:   editForm.documentType,
        serviceDate:    new Date(editForm.serviceDate),
        streetAddress:  editForm.streetAddress || null,
        city:           editForm.city           || null,
        state:          editForm.state          || null,
        zipCode:        editForm.zipCode        || null,
        email:          editForm.email          || null,
      };
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingCompany(null);
      setEditForm(null);
      router.refresh();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

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
            <tr className="border-b bg-gray-50 text-left whitespace-nowrap">
              <SortHeader col="companyName"    label="Company"  sort={sort} />
              <SortHeader col="usdotNumber"    label="DOT#"     sort={sort} />
              <SortHeader col="documentNumber" label="Document" sort={sort} />
              <SortHeader col="documentType"   label="Type"     sort={sort} />
              <SortHeader col="serviceDate"    label="Date"     sort={sort} />
              <SortHeader col="city"           label="Location" sort={sort} />
              <SortHeader col="email"          label="Email"    sort={sort} />
              <th className="px-4 py-3 text-gray-600">Scraped Email</th>
              <th className="px-4 py-3 text-gray-600">PDF</th>
              <SortHeader col="createdAt"      label="Added"    sort={sort} />
              <th className="px-4 py-3 text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                scrapedEmail={scrapedEmailMap[c.usdotNumber] || null}
                onEdit={openEdit}
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

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingCompany && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg font-bold">Edit Company</h2>
              <button
                onClick={() => { setEditingCompany(null); setEditForm(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                  {editError}
                </p>
              )}

              {/* Company Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editForm.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    DBA Name
                  </label>
                  <input
                    value={editForm.dbaName}
                    onChange={(e) => updateField("dbaName", e.target.value)}
                    placeholder="Doing Business As…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* DOT + Doc */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    USDOT Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editForm.usdotNumber}
                    onChange={(e) => updateField("usdotNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Document Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editForm.documentNumber}
                    onChange={(e) => updateField("documentNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <select
                    value={editForm.documentType}
                    onChange={(e) => updateField("documentType", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="CERTIFICATE">CERTIFICATE</option>
                    <option value="PERMIT">PERMIT</option>
                    <option value="LICENSE">LICENSE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              {/* Service Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Service Date
                  </label>
                  <input
                    type="date"
                    value={editForm.serviceDate}
                    onChange={(e) => updateField("serviceDate", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="company@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  value={editForm.streetAddress}
                  onChange={(e) => updateField("streetAddress", e.target.value)}
                  placeholder="123 Main St"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    value={editForm.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    value={editForm.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    maxLength={2}
                    placeholder="TX"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    value={editForm.zipCode}
                    onChange={(e) => updateField("zipCode", e.target.value)}
                    placeholder="12345"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setEditingCompany(null); setEditForm(null); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editForm.companyName || !editForm.usdotNumber}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────────────── */}
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

// ─── CompanyRow ──────────────────────────────────────────────────────────────
function CompanyRow({
  company,
  scrapedEmail,
  onEdit,
  onDelete,
  onUpdated,
}: {
  company: Company;
  scrapedEmail: string | null;
  onEdit: (c: Company) => void;
  onDelete: (id: string) => void;
  onUpdated: (c: Company) => void;
}) {
  const [email, setEmail]           = useState(company.email || "");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState(company.emailStatus);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState<string | null>(null);
  const [hasPdf, setHasPdf]         = useState(!!company.pdfFilename);
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
      {/* Company name */}
      <td className="px-4 py-2">
        <div className="font-medium">{company.companyName}</div>
        {company.dbaName && (
          <div className="text-xs text-gray-400">D/B/A {company.dbaName}</div>
        )}
      </td>

      <td className="px-4 py-2">{company.usdotNumber}</td>
      <td className="px-4 py-2 font-mono text-xs">{company.documentNumber}</td>

      {/* Type badge */}
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
      <td className="px-4 py-2 text-gray-600">{company.city}, {company.state}</td>

      {/* Email */}
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

      {/* Scraped Email */}
      <td className="px-4 py-2">
        {scrapedEmail ? (
          <span className="text-xs text-purple-700 italic">{scrapedEmail}</span>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        )}
      </td>

      {/* PDF */}
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

      {/* Added date */}
      <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
        {formatDate(company.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(company)}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(company.id)}
            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
