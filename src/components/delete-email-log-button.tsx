"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteEmailLogButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this email log entry? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/admin/email-logs/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? "…" : "Delete"}
    </button>
  );
}
