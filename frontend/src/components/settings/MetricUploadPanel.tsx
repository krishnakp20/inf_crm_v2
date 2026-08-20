import { Download, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { api } from "../../lib/api";
import { SortableHeader } from "../shared/SortableHeader";
import type { MetricImport, MetricUploadResult } from "../../lib/types";

function getHistoryValue(h: MetricImport, field: string): unknown {
  switch (field) {
    case "filename":
      return h.filename;
    case "total_rows":
      return h.total_rows;
    case "uploaded_by_name":
      return h.uploaded_by_name;
    case "created_at":
      return h.created_at;
    case "status":
      return h.status;
    default:
      return null;
  }
}

const REQUIRED_COLUMNS: { label: string; hint: string }[] = [
  { label: "POC Code", hint: "Unique match key" },
  { label: "Video Link", hint: "Cross-check" },
  { label: "Views", hint: "Whole number" },
  { label: "Likes", hint: "Whole number" },
  { label: "Comments", hint: "Whole number" },
  { label: "Revenue", hint: "Attributed revenue" },
  { label: "Ad Spend", hint: "Media spend" },
  { label: "ROAS", hint: "Revenue ÷ spend" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

export function MetricUploadPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<MetricUploadResult | null>(null);
  const [history, setHistory] = useState<MetricImport[]>([]);
  const { sorted: sortedHistory, field: historyField, direction: historyDirection, toggle: toggleHistorySort } = useSort(
    history,
    getHistoryValue
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadHistory() {
    api.get<MetricImport[]>("/settings/metric-upload/history").then((res) => setHistory(res.data));
  }

  useEffect(loadHistory, []);

  function downloadTemplate() {
    const lines = [REQUIRED_COLUMNS.map((c) => c.label).join(",")];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "metric-upload-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
  }

  async function handleImport() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("upload", selectedFile);
      const res = await api.post<MetricUploadResult>("/settings/metric-upload", formData);
      setResult(res.data);
      setSelectedFile(null);
      loadHistory();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="dashboard-card p-5">
      <h2 className="mb-1 text-base font-semibold text-ink">Upload video metrics</h2>
      <p className="mb-4 text-sm text-gray-500">
        Match every row using its POC code and video link, then update the connected Campaign, Partnership Hub and
        Analytics records together.
      </p>

      <div className="mb-5">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
          1. Choose the completed metrics sheet
        </p>
        <p className="mb-2 text-xs text-gray-500">
          CSV or Excel · one row per Live video. The source of truth remains the Live video record from My Creators.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handlePick} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface"
          >
            <Upload size={14} />
            {selectedFile ? "Choose a different file" : "Drop a metrics sheet here or browse"}
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 rounded-[10px] px-2 text-xs font-bold text-brand-600 hover:underline"
          >
            <Download size={12} />
            Download template
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          {selectedFile ? (
            <>
              <span className="font-semibold text-ink">{selectedFile.name}</span>
              <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-gray-600">
                Remove
              </button>
            </>
          ) : (
            <span>No sheet selected.</span>
          )}
        </div>
      </div>

      <div className="mb-5">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">2. Required columns</p>
        <p className="mb-2 text-xs text-gray-500">Column names are validated before any record changes.</p>
        <div className="grid grid-cols-4 gap-2">
          {REQUIRED_COLUMNS.map((c) => (
            <div key={c.label} className="rounded-card border border-[#e7e5e4] p-2.5">
              <div className="text-xs font-bold text-ink">{c.label}</div>
              <div className="text-[10px] text-gray-500">{c.hint}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          A row updates only when both the POC code and video link match the same Live record. Revenue and ROAS are
          accepted only in this Admin view.
        </p>
      </div>

      {result && (
        <div className="mb-5 rounded-card border border-[#e7e5e4] bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>
              Upload: <strong>{result.total_rows}</strong> rows, <strong>{result.updated}</strong> updated,{" "}
              <strong>{result.skipped}</strong> skipped
              {result.errors.length > 0 && `, ${result.errors.length} errors`}
            </span>
            <button onClick={() => setResult(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Dismiss
            </button>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-[#cf4e43]">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
        {selectedFile && (
          <button onClick={() => setSelectedFile(null)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
            <X size={12} /> Remove
          </button>
        )}
        <button
          onClick={handleImport}
          disabled={!selectedFile || uploading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {uploading ? "Validating..." : "Validate & import"}
        </button>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Recent imports</p>
        <p className="mb-2 text-xs text-gray-500">Admin audit trail</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-400">
                <SortableHeader label="File" field="filename" activeField={historyField} direction={historyDirection} onSort={toggleHistorySort} className="pb-2" />
                <SortableHeader label="Records" field="total_rows" activeField={historyField} direction={historyDirection} onSort={toggleHistorySort} className="pb-2" />
                <SortableHeader label="Updated by" field="uploaded_by_name" activeField={historyField} direction={historyDirection} onSort={toggleHistorySort} className="pb-2" />
                <SortableHeader label="Status" field="status" activeField={historyField} direction={historyDirection} onSort={toggleHistorySort} className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="py-2.5 text-ink">{h.filename}</td>
                  <td className="py-2.5 text-gray-600">{h.total_rows}</td>
                  <td className="py-2.5 text-gray-600">
                    {h.uploaded_by_name} · {formatDate(h.created_at)}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        h.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-[#fff0ed] text-[#cf4e43]"
                      }`}
                    >
                      {h.status === "completed" ? "Completed" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-gray-400">
                    No imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
