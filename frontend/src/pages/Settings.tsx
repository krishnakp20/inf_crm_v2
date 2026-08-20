import { useState } from "react";
import { Navigate } from "react-router-dom";
import { MetricUploadPanel } from "../components/settings/MetricUploadPanel";
import { ProductsPanel } from "../components/settings/ProductsPanel";
import { StageDeadlinesPanel } from "../components/settings/StageDeadlinesPanel";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";

type Panel = "stage-deadlines" | "products" | "metric-upload";

const PANELS: { key: Panel; label: string; hint: string }[] = [
  { key: "stage-deadlines", label: "Stage deadlines", hint: "Lead ageing rules" },
  { key: "products", label: "Products", hint: "Shared product master" },
  { key: "metric-upload", label: "Upload metrics", hint: "Sync Live video results" },
];

export default function Settings() {
  const { user } = useAuth();
  const [panel, setPanel] = useState<Panel>("stage-deadlines");

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div>
      <Topbar title="Settings" subtitle="Configure shared CRM rules for the complete team." />

      <div className="flex gap-5">
        <nav className="w-52 shrink-0">
          <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-400">Panel configuration</div>
          <div className="flex flex-col gap-1">
            {PANELS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPanel(p.key)}
                className={`rounded-lg px-3 py-2 text-left ${
                  panel === p.key ? "bg-brand-100" : "hover:bg-surface"
                }`}
              >
                <div className={`text-sm font-semibold ${panel === p.key ? "text-brand-600" : "text-ink"}`}>{p.label}</div>
                <div className="text-[11px] text-gray-400">{p.hint}</div>
              </button>
            ))}
          </div>
        </nav>
        <div className="flex-1">
          {panel === "stage-deadlines" ? (
            <StageDeadlinesPanel />
          ) : panel === "products" ? (
            <ProductsPanel />
          ) : (
            <MetricUploadPanel />
          )}
        </div>
      </div>
    </div>
  );
}
