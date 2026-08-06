import { Bell, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    api.get<{ count: number }>("/dashboard/notifications-count").then((res) => setNotificationCount(res.data.count));
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
            placeholder="Search creators, campaigns or employees..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-[#e7e5e4] bg-white px-1.5 py-0.5 text-[10px] text-gray-400">⌘ K</kbd>
        </div>
      </form>

      <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7e5e4] text-ink">
        <Bell size={18} />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cf4e43] px-1 text-[10px] font-bold text-white">
            {notificationCount}
          </span>
        )}
      </button>
    </header>
  );
}
