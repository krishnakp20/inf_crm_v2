import { Megaphone, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AnnouncementOut, User } from "../../lib/types";

const AUDIENCES: { label: string; value: "everyone" | "team" | "selected" }[] = [
  { label: "Everyone", value: "everyone" },
  { label: "Influencer team", value: "team" },
  { label: "Selected employees", value: "selected" },
];

export function AnnouncementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"everyone" | "team" | "selected">("everyone");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [pinned, setPinned] = useState(true);
  const [advisors, setAdvisors] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<User[]>("/users").then((res) => setAdvisors(res.data.filter((u) => u.role === "advisor")));
    api.get<AnnouncementOut[]>("/announcements").then((res) => {
      const current = res.data[0];
      if (!current) return;
      setTitle(current.title);
      setBody(current.body);
      setAudience(current.audience);
      setSelectedUserIds(current.audience_user_ids ?? []);
      setExpiresAt(current.expires_at ?? "");
      setPinned(current.pinned);
    });
  }, []);

  function toggleSelectedUser(id: number) {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/announcements", {
        title,
        body,
        audience,
        audience_user_ids: audience === "selected" ? selectedUserIds : null,
        expires_at: expiresAt || null,
        pinned,
      });
      onSaved();
      onClose();
    } catch {
      setError("Could not post announcement. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[440px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Megaphone size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Team announcement</h2>
              <p className="text-xs text-gray-500">Visible on every employee's dashboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Announcement title</label>
            <span className="text-[11px] text-gray-400">{title.length}/60</span>
          </div>
          <input
            required
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Priority for this week"
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
          <textarea
            required
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mb-3 text-[11px] text-gray-400">Keep the action clear and easy to scan.</p>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as "everyone" | "team" | "selected")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Expires</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {audience === "selected" && (
            <div className="mb-3 rounded-md border border-gray-200 p-2.5">
              <p className="mb-1.5 text-xs font-medium text-gray-700">Choose employees</p>
              <div className="flex flex-col gap-1.5">
                {advisors.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(a.id)}
                      onChange={() => toggleSelectedUser(a.id)}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="mb-3 flex items-start gap-2.5 rounded-card border border-[#e7e5e4] p-3">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong className="block text-sm text-ink">Pin to dashboard</strong>
              <small className="text-xs text-gray-500">Keep visible until it expires or is removed.</small>
            </span>
          </label>

          <div className="rounded-card border border-[#e7e5e4] bg-surface p-3">
            <span className="mb-1 block text-[11px] font-semibold text-gray-400">Preview</span>
            <strong className="block text-sm text-ink">{title || "Announcement title"}</strong>
            <p className="mt-0.5 text-xs text-gray-500">{body || "Your message will appear here."}</p>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-[#e7e5e4] p-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send size={14} />
              {submitting ? "Publishing..." : "Publish to team"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
