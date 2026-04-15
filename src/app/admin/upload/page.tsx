"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Fetch from FMCSA section ────────────────────────────────────────────────

type FetchState =
  | { phase: "idle" }
  | { phase: "fetching" }
  | { phase: "not_found" }
  | { phase: "already_exists"; sourcePdfId: string; pdfStatus: string; companyCount: number | null }
  | { phase: "processing"; sourcePdfId: string; companyCount: number | null; totalPages: number | null }
  | { phase: "completed"; companyCount: number }
  | { phase: "failed"; message: string };

function FetchFromFMCSA() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [state, setState] = useState<FetchState>({ phase: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  function startPolling(sourcePdfId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/source-pdf/${sourcePdfId}`);
        const data = await res.json();
        if (data.status === "completed") {
          stopPolling();
          setState({ phase: "completed", companyCount: data.companyCount ?? 0 });
        } else if (data.status === "failed") {
          stopPolling();
          setState({ phase: "failed", message: data.error || "Processing failed" });
        } else {
          setState({
            phase: "processing",
            sourcePdfId,
            companyCount: data.companyCount ?? null,
            totalPages: data.totalPages ?? null,
          });
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000);
  }

  async function handleFetch() {
    setState({ phase: "fetching" });
    stopPolling();
    try {
      const res = await fetch("/api/admin/fetch-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();

      if (data.status === "not_found") {
        setState({ phase: "not_found" });
      } else if (data.status === "already_exists") {
        if (data.pdfStatus === "completed") {
          setState({
            phase: "already_exists",
            sourcePdfId: data.sourcePdfId,
            pdfStatus: data.pdfStatus,
            companyCount: data.companyCount,
          });
        } else if (data.pdfStatus === "processing" || data.pdfStatus === "pending") {
          setState({ phase: "processing", sourcePdfId: data.sourcePdfId, companyCount: null, totalPages: null });
          startPolling(data.sourcePdfId);
        } else {
          setState({
            phase: "already_exists",
            sourcePdfId: data.sourcePdfId,
            pdfStatus: data.pdfStatus,
            companyCount: data.companyCount,
          });
        }
      } else if (data.status === "downloaded") {
        setState({ phase: "processing", sourcePdfId: data.sourcePdfId, companyCount: null, totalPages: null });
        startPolling(data.sourcePdfId);
      } else {
        setState({ phase: "failed", message: data.error || "Unexpected error" });
      }
    } catch {
      setState({ phase: "failed", message: "Network error. Please try again." });
    }
  }

  const busy = state.phase === "fetching" || state.phase === "processing";

  function ProgressBar({ pct }: { pct: number | null }) {
    if (pct !== null) {
      return (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Processing…</span>
            <span className="font-semibold text-blue-600">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mt-3">
        <div className="h-3 w-full bg-blue-500 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Fetch from FMCSA</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Check the FMCSA server for the PDF for a specific date and import it automatically.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setState({ phase: "idle" }); }}
            disabled={busy}
          />
        </div>
        <Button onClick={handleFetch} disabled={busy || !date}>
          {state.phase === "fetching" ? "Checking..." : state.phase === "processing" ? "Processing..." : "Check & Download"}
        </Button>
      </div>

      {/* Status feedback */}
      {state.phase === "fetching" && (
        <div className="mt-3">
          <p className="text-sm text-blue-600">Contacting FMCSA server...</p>
          <ProgressBar pct={null} />
        </div>
      )}

      {state.phase === "processing" && (() => {
        const expectedTotal = state.totalPages ? Math.floor(state.totalPages / 2) : null;
        const pct =
          expectedTotal && expectedTotal > 0 && state.companyCount !== null
            ? Math.min(99, Math.round((state.companyCount / expectedTotal) * 100))
            : null;
        return (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-blue-600">Parsing PDF &amp; saving companies...</p>
              {state.companyCount !== null && state.companyCount > 0 && (
                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {state.companyCount}{expectedTotal ? ` / ${expectedTotal}` : ""} companies
                </span>
              )}
            </div>
            <ProgressBar pct={pct} />
            <p className="text-xs text-gray-400 mt-1">This may take several minutes for large PDFs.</p>
          </div>
        );
      })()}

      {state.phase === "completed" && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600 text-lg">✓</span>
          <p className="text-sm text-green-700 font-medium">
            Done! {state.companyCount} companies extracted and saved.
          </p>
        </div>
      )}

      {state.phase === "already_exists" && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          {state.pdfStatus === "completed" ? (
            <p className="text-sm text-blue-700">
              ✓ Already downloaded for this date.{" "}
              {state.companyCount !== null && `${state.companyCount} companies on record.`}
            </p>
          ) : (
            <p className="text-sm text-blue-700">
              File already exists (status: <strong>{state.pdfStatus}</strong>).
            </p>
          )}
        </div>
      )}

      {state.phase === "not_found" && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            No PDF found for <strong>{date}</strong> (tried previous business day too).
            FMCSA may not have published it yet — try again later.
          </p>
        </div>
      )}

      {state.phase === "failed" && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            className="mt-1 text-xs text-red-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Generate Previews section ──────────────────────────────────────────────

function GeneratePreviews() {
  const [pending, setPending] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ generated: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/generate-documents")
      .then((r) => r.json())
      .then((d) => setPending(d.pending ?? null))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-documents", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({ generated: data.generated, total: data.total ?? data.generated });
        setPending(0);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Generate Document Previews</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Creates a clean formatted PDF and a blurred preview image for each company. Used in emails and on the payment page.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleGenerate} disabled={running || pending === 0}>
          {running ? "Generating..." : "Generate Now"}
        </Button>
        {pending !== null && (
          <span className="text-sm text-gray-500">
            {pending === 0
              ? "All previews up to date."
              : `${pending} compan${pending === 1 ? "y needs" : "ies need"} a preview.`}
          </span>
        )}
      </div>

      {running && (
        <div className="mt-3 w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="h-3 w-full bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {result && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-700 font-medium">
            Generated {result.generated} preview{result.generated !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </Card>
  );
}

// ─── Manual upload section ───────────────────────────────────────────────────

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

      {/* Auto-fetch from FMCSA */}
      <FetchFromFMCSA />

      {/* Generate document previews */}
      <GeneratePreviews />

      {/* Manual upload */}
      <Card>
        <h2 className="text-base font-semibold mb-4">Manual Upload</h2>
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
            <label className="block text-sm font-medium mb-1">Issue Date</label>
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
