import { Download, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { toLocalDateString } from "../../lib/dateRange";
import { displayHandle, externalUrl } from "../../lib/format";
import type { ActiveReelsOut, CreatorsAddedOut } from "../../lib/types";
import { SortableHeader } from "../shared/SortableHeader";

export type DrilldownKind = "reels" | "creators";

interface DrillRow {
  id: number;
  /** The agent (reels) or owner (creators) -- drives the per-person chips. */
  person: string;
  values: Record<string, string | number | null>;
}

interface Column {
  key: string;
  label: string;
  kind?: "date" | "number" | "link";
}

interface DrillData {
  total: number;
  people: { name: string; count: number }[];
  rows: DrillRow[];
}

const CONFIG: Record<
  DrilldownKind,
  { title: string; personLabel: string; endpoint: string; filePrefix: string; columns: Column[] }
> = {
  reels: {
    title: "Active reels",
    personLabel: "Agent",
    endpoint: "/dashboard/active-reels",
    filePrefix: "active-reels",
    columns: [
      { key: "creator", label: "Creator" },
      { key: "handle", label: "Instagram" },
      { key: "product", label: "Product" },
      { key: "person", label: "Agent" },
      { key: "live_date", label: "Live date", kind: "date" },
      { key: "poc_code", label: "POC code" },
      { key: "video_link", label: "Video", kind: "link" },
    ],
  },
  creators: {
    title: "Total creators",
    personLabel: "Owner",
    endpoint: "/dashboard/creators-added",
    filePrefix: "creators",
    columns: [
      { key: "creator", label: "Creator" },
      { key: "handle", label: "Instagram" },
      { key: "person", label: "Owner" },
      { key: "category", label: "Category" },
      { key: "followers", label: "Followers", kind: "number" },
      { key: "added", label: "Added on", kind: "date" },
    ],
  },
};

const PAGE_SIZE = 200;

function toDrillData(kind: DrilldownKind, raw: ActiveReelsOut | CreatorsAddedOut): DrillData {
  if (kind === "reels") {
    const data = raw as ActiveReelsOut;
    return {
      total: data.total,
      people: data.by_agent,
      rows: data.rows.map((r) => ({
        id: r.collab_id,
        person: r.agent_name,
        values: {
          creator: r.creator_name,
          handle: `@${displayHandle(r.creator_handle)}`,
          product: r.products,
          person: r.agent_name,
          live_date: r.live_date,
          poc_code: r.poc_code,
          video_link: r.video_link,
        },
      })),
    };
  }
  const data = raw as CreatorsAddedOut;
  return {
    total: data.total,
    people: data.by_owner,
    rows: data.rows.map((r) => ({
      id: r.creator_id,
      person: r.owner_name,
      values: {
        creator: r.name,
        handle: `@${displayHandle(r.instagram_handle)}`,
        person: r.owner_name,
        category: r.category,
        followers: r.followers_count,
        added: toLocalDateString(r.created_at),
      },
    })),
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function getValue(row: DrillRow, field: string): unknown {
  return row.values[field];
}

export function KpiDrilldownDrawer({
  kind,
  dateFrom,
  dateTo,
  subtitle,
  onClose,
}: {
  kind: DrilldownKind;
  dateFrom?: string;
  dateTo?: string;
  /** e.g. "Reels gone live in the last 7 days" -- the same words as the tile. */
  subtitle: string;
  onClose: () => void;
}) {
  const config = CONFIG[kind];
  const [data, setData] = useState<DrillData | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setData(null);
    setError(false);
    api
      .get<ActiveReelsOut | CreatorsAddedOut>(config.endpoint, { params: { date_from: dateFrom, date_to: dateTo } })
      .then((res) => setData(toDrillData(kind, res.data)))
      .catch(() => setError(true));
  }, [kind, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (!person || r.person === person) &&
        (!q || Object.values(r.values).some((v) => v != null && String(v).toLowerCase().includes(q)))
    );
  }, [data, search, person]);

  const { sorted, field, direction, toggle } = useSort(filtered, getValue);

  useEffect(() => setLimit(PAGE_SIZE), [search, person, field, direction]);

  function exportCsv() {
    const header = config.columns.map((c) => c.label);
    const rows = sorted.map((r) => config.columns.map((c) => String(r.values[c.key] ?? "")));
    downloadCsv(`${config.filePrefix}-${toLocalDateString(new Date().toISOString())}.csv`, header, rows);
  }

  function renderCell(row: DrillRow, col: Column) {
    const value = row.values[col.key];
    if (value == null || value === "") return <span className="text-gray-300">—</span>;
    if (col.kind === "date") return formatDate(String(value));
    if (col.kind === "number") return Number(value).toLocaleString();
    if (col.kind === "link") {
      return (
        <a
          href={externalUrl(String(value))}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand-600 hover:underline"
        >
          Open
        </a>
      );
    }
    return String(value);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[760px] max-w-full flex-col bg-white shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {config.title}
              {data && <span className="ml-2 text-brand-600">{data.total.toLocaleString()}</span>}
            </h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {error && <p className="p-5 text-sm text-red-600">Could not load this list. Please try again.</p>}
        {!error && !data && <p className="p-5 text-sm text-gray-400">Loading...</p>}

        {data && (
          <>
            <div className="border-b border-[#e7e5e4] p-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">By {config.personLabel.toLowerCase()}</p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                <button
                  onClick={() => setPerson("")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    person === "" ? "border-brand-300 bg-brand-50 text-brand-600" : "border-[#e7e5e4] text-ink hover:bg-surface"
                  }`}
                >
                  All · {data.total.toLocaleString()}
                </button>
                {data.people.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setPerson(person === p.name ? "" : p.name)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      person === p.name ? "border-brand-300 bg-brand-50 text-brand-600" : "border-[#e7e5e4] text-ink hover:bg-surface"
                    }`}
                  >
                    {p.name} · {p.count.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-4 pb-2">
              <div className="flex h-9 w-full max-w-[300px] items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5">
                <Search size={14} className="shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this list..."
                  className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500">
                  {filtered.length === data.total ? `${data.total.toLocaleString()} rows` : `${filtered.length.toLocaleString()} of ${data.total.toLocaleString()}`}
                </span>
                <button
                  onClick={exportCsv}
                  disabled={filtered.length === 0}
                  className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] px-3 text-xs font-bold text-ink hover:bg-surface disabled:opacity-40"
                >
                  <Download size={13} />
                  Export
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-[#e7e5e4] text-left uppercase tracking-wide text-gray-400">
                    {config.columns.map((c) => (
                      <SortableHeader
                        key={c.key}
                        label={c.label}
                        field={c.key}
                        activeField={field}
                        direction={direction}
                        onSort={toggle}
                        className="whitespace-nowrap pb-2 pr-3 text-[10px] font-medium"
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, limit).map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      {config.columns.map((c) => (
                        <td key={c.key} className={`py-2 pr-3 ${c.key === "creator" ? "font-semibold text-ink" : "text-gray-600"}`}>
                          {renderCell(row, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={config.columns.length} className="py-8 text-center text-gray-400">
                        Nothing to show for these dates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {sorted.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="mt-3 w-full rounded-lg border border-[#e7e5e4] py-2 text-xs font-bold text-brand-600 hover:bg-surface"
                >
                  Show more ({(sorted.length - limit).toLocaleString()} left)
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
