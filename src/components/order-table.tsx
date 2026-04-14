"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrderRow {
  id: string;
  status: string;
  paymentMethod: string;
  paymentId: string | null;
  customerEmail: string | null;
  amount: number;
  downloadCount: number;
  maxDownloads: number;
  downloadToken: string;
  expiresAt: Date;
  createdAt: Date;
  company: {
    id: string;
    companyName: string;
    usdotNumber: string;
    documentNumber: string;
  };
}

function fmtDate(d: Date) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function fmtDateTime(d: Date) {
  const dt = new Date(d);
  return (
    fmtDate(d) +
    " " +
    String(dt.getUTCHours()).padStart(2, "0") +
    ":" +
    String(dt.getUTCMinutes()).padStart(2, "0")
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-purple-100 text-purple-800",
};

export function OrderTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<OrderRow[]>(orders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // edit form state
  const [editStatus, setEditStatus] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMaxDownloads, setEditMaxDownloads] = useState("");
  const [editDownloadCount, setEditDownloadCount] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  function openEdit(order: OrderRow) {
    setEditingId(order.id);
    setEditStatus(order.status);
    setEditEmail(order.customerEmail || "");
    setEditMaxDownloads(String(order.maxDownloads));
    setEditDownloadCount(String(order.downloadCount));
    // format as datetime-local value: YYYY-MM-DDTHH:MM
    const d = new Date(order.expiresAt);
    const iso = d.toISOString().slice(0, 16);
    setEditExpiresAt(iso);
    setError("");
  }

  async function handleSave() {
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          customerEmail: editEmail,
          maxDownloads: editMaxDownloads,
          downloadCount: editDownloadCount,
          expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                status: editStatus,
                customerEmail: editEmail || null,
                maxDownloads: Number(editMaxDownloads),
                downloadCount: Number(editDownloadCount),
                expiresAt: new Date(editExpiresAt),
              }
            : r
        )
      );
      setEditingId(null);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">DOT #</th>
              <th className="px-4 py-3">Buyer Email</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Downloads</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400">
                  No orders found
                </td>
              </tr>
            )}
            {rows.map((order) => (
              <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                  {fmtDateTime(order.createdAt)}
                </td>
                <td className="px-4 py-2 font-medium max-w-[160px] truncate">
                  <span title={order.company.companyName}>
                    {order.company.companyName}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600">{order.company.usdotNumber}</td>
                <td className="px-4 py-2">
                  {order.customerEmail ? (
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="text-blue-600 hover:underline"
                    >
                      {order.customerEmail}
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.paymentMethod === "stripe"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {order.paymentMethod}
                  </span>
                </td>
                <td className="px-4 py-2 font-semibold text-green-700">
                  ${(order.amount / 100).toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`font-medium ${
                      order.downloadCount >= order.maxDownloads
                        ? "text-red-600"
                        : "text-gray-700"
                    }`}
                  >
                    {order.downloadCount}/{order.maxDownloads}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                  {fmtDate(order.expiresAt)}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(order)}
                      className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 border border-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteId(order.id); setError(""); }}
                      className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 border border-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit Modal ── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">Edit Order</h2>

            {error && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="pending">pending</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="refunded">refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyer Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Downloads
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editMaxDownloads}
                    onChange={(e) => setEditMaxDownloads(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Download Count
                    <span className="text-gray-400 font-normal ml-1">(reset = 0)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDownloadCount}
                    onChange={(e) => setEditDownloadCount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At
                </label>
                <input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Delete Order?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the order record. The buyer&apos;s
              download link will stop working.
            </p>
            {error && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {error}
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
