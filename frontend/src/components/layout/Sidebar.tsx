import {
  ArrowRight,
  BarChart3,
  Handshake,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Settings,
  Sparkles,
  Table2,
  UsersRound,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { initials, roleLabel } from "../../lib/format";

const DASHBOARD_ITEM = { to: "/", label: "Dashboard", icon: LayoutGrid };

const CAMPAIGNS_ITEM = { to: "/campaigns", label: "Campaigns", icon: Megaphone };

const PARTNERSHIP_ITEM = { to: "/partnership", label: "Partnership Hub", icon: Handshake };

const ANALYTICS_ITEM = { to: "/analytics", label: "Analytics", icon: BarChart3 };

const CREATOR_WORKSPACE_ITEMS = [
  { to: "/database", label: "Database", icon: Table2 },
  { to: "/my-creators", label: "My Creators", icon: UsersRound },
];

const ADMIN_NAV_ITEMS = [
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  to,
  label,
  icon: Icon,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  badge?: number | null;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          isActive ? "bg-brand-100 text-brand-600" : "text-[#625e69] hover:bg-white"
        }`
      }
    >
      <span className="flex items-center gap-2">
        <Icon size={16} />
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-brand-600">{badge}</span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [myCreatorsCount, setMyCreatorsCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

  const inCreatorWorkspace = user?.role !== "marketer" && user?.role !== "editor";
  const canSeeCampaigns = user?.role !== "editor";
  const canSeeAnalytics = user?.role !== "editor";

  useEffect(() => {
    if (!user) return;
    if (user.role === "advisor") {
      api
        .get("/creators", { params: { owner_id: user.id, limit: 1 } })
        .then((res) => setMyCreatorsCount(res.data.total));
    } else if (user.role === "supervisor") {
      api.get("/creators", { params: { limit: 1 } }).then((res) => setMyCreatorsCount(res.data.total));
    }
    api.get("/dashboard/my-progress").then((res) => setProgress(res.data));
  }, [user]);

  const progressPct = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[#e7e5e4] bg-surface px-4 py-6">
      <div className="flex-1 overflow-y-auto">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </div>
          <div>
            <div className="text-base font-bold text-ink">Sotrue</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Influencer CRM</div>
          </div>
        </div>
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">Workspace</div>
        <nav className="flex flex-col gap-1">
          <NavItem {...DASHBOARD_ITEM} />
          {canSeeCampaigns && <NavItem {...CAMPAIGNS_ITEM} />}
          <NavItem {...PARTNERSHIP_ITEM} />
          {canSeeAnalytics && <NavItem {...ANALYTICS_ITEM} />}
          {inCreatorWorkspace &&
            CREATOR_WORKSPACE_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                badge={item.to === "/my-creators" ? myCreatorsCount : undefined}
              />
            ))}
        </nav>

        {user?.role === "admin" && (
          <>
            <div className="mb-2 mt-6 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Administration
            </div>
            <nav className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="mt-auto">
        {progress && progress.total > 0 && (
          <div className="mb-4 rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <Sparkles size={14} />
              </span>
              <strong className="text-xs font-bold text-ink">Today's progress</strong>
            </div>
            <div className="mt-1.5 text-[11px] text-muted">
              {progress.completed} of {progress.total} follow-ups done
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white">
              <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${progressPct}%` }} />
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
            >
              View my targets
              <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="relative border-t border-[#e7e5e4] pt-4">
        <button onClick={() => setMenuOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-lg p-1 hover:bg-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
            {user ? initials(user.name) : ""}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-ink">{user?.name}</div>
            <div className="text-xs text-gray-500">{user ? roleLabel(user.role) : ""}</div>
          </div>
          <MoreHorizontal size={16} className="text-gray-400" />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-lg border border-[#e7e5e4] bg-white shadow-sm">
            <Link
              to="/change-password"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#625e69] hover:bg-surface"
            >
              <KeyRound size={14} />
              Change password
            </Link>
            <button
              onClick={logout}
              className="w-full border-t border-[#e7e5e4] px-3 py-2 text-left text-sm text-[#625e69] hover:bg-surface"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
