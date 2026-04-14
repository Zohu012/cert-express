"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    id?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);

    const form = new FormData();
    form.append("pdf", file);
    form.append("issueDate", issueDate);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Upload failed" });
    }
    setUploading(false);
  }

  async function handleProcess() {
    if (!result?.id) return;
    setProcessing(true);
    setStatus("processing");

    try {
      await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePdfId: result.id }),
      });

      // Poll for status
      const interval = setInterval(async () => {
        const res = await fetch(`/api/admin/source-pdf/${result.id}`);
        const data = await res.json();
        setStatus(data.status);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          setProcessing(false);
          if (data.status === "completed") {
            setResult({
              ...result,
              message: `Done! ${data.companyCount} companies extracted.`,
            });
          }
        }
      }, 2000);
    } catch {
      setStatus("failed");
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Upload PDF</h1>

      <Card>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              FMCSA Certificate PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Issue Date
            </label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 p-4 rounded-lg bg-gray-50 border">
            {result.error ? (
              <p className="text-red-600 text-sm">{result.error}</p>
            ) : (
              <div>
                <p className="text-green-700 text-sm mb-3">{result.message}</p>
                {result.id && status !== "completed" && (
                  <Button
                    onClick={handleProcess}
                    disabled={processing}
                    variant={processing ? "secondary" : "primary"}
                  >
                    {processing
                      ? `Processing (${status})...`
                      : "Process PDF"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
