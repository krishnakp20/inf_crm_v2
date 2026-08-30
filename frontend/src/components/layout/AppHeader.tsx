import { Bell, Search } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { initials } from "../../lib/format";
import type { Notification } from "../../lib/types";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#fff0ed] text-[#cf4e43]",
  normal: "bg-gray-100 text-gray-500",
};

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function loadNotifications() {
    api.get<Notification[]>("/dashboard/notifications").then((res) => setNotifications(res.data));
  }

  useEffect(loadNotifications, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/database?search=${encodeURIComponent(query.trim())}`);
  }

  if (!user) return null;

  return (
    <header className="flex items-center gap-4 border-b border-[#e7e5e4] bg-white px-6 py-3">
      <form onSubmit={handleSearchSubmit} className="flex-1">
        <div className="flex items-center gap-2 rounded-lg border border-[#e7e5e4] bg-surface px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, campaigns or users..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-[#e7e5e4] bg-white px-1.5 py-0.5 text-[10px] text-gray-400">⌘ K</kbd>
        </div>
      </form>

      <div ref={ref} className="relative">
        <button
          onClick={() => {
            if (!open) loadNotifications();
            setOpen((v) => !v);
          }}
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7e5e4] text-ink hover:bg-surface"
        >
          <Bell size={18} />
          {notifications.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cf4e43] px-1 text-[10px] font-bold text-white">
              {notifications.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-card border border-[#e7e5e4] bg-white p-2 shadow-lg">
            <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <Link
                  key={`${n.kind}-${n.id}`}
                  to={n.link}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-surface"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                    {initials(n.creator_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-xs font-semibold text-ink">{n.creator_name}</div>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${PRIORITY_STYLES[n.priority]}`}
                      >
                        {n.priority}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-gray-500">{n.subtitle}</div>
                  </div>
                </Link>
              ))}
              {notifications.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-gray-400">No pending notifications.</p>
              )}
            </div>
            {notifications.length > 0 && (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-brand-600 hover:bg-surface"
              >
                View all in Dashboard
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
