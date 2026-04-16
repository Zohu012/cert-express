"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MigrateEmailsButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleMigrate() {
    setMigrating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/companies/migrate-emails", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Migration failed");
      setResult(`Migrated ${data.migrated} email(s)`);
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Error");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
      >
        Migrate Emails
      </button>

      {result && !confirming && (
        <span className="text-sm text-gray-600 ml-2">{result}</span>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Migrate Scraped Emails?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will copy scraped emails from otrucking data to companies that currently
              have <strong>no email</strong>. Existing emails will not be overwritten.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {migrating ? "Migrating..." : "Yes, Migrate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
