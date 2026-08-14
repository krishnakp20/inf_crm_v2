import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PasswordInput } from "../components/common/PasswordInput";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { User } from "../lib/types";

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [maxActiveAdvisors, setMaxActiveAdvisors] = useState(10);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  function loadUsers() {
    api.get<User[]>("/users").then((res) => setUsers(res.data));
  }

  useEffect(() => {
    loadUsers();
    api.get<{ max_active_advisors: number }>("/users/limits").then((res) => {
      setMaxActiveAdvisors(res.data.max_active_advisors);
    });
  }, []);

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const advisors = users.filter((u) => u.role === "advisor");
  const activeCount = advisors.filter((a) => a.is_active).length;
  const atCap = activeCount >= maxActiveAdvisors;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/users", { name, email, password, role: "advisor" });
      setName("");
      setEmail("");
      setPassword("");
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not create advisor");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(advisor: User) {
    setToggleError(null);
    setTogglingId(advisor.id);
    try {
      await api.post(`/users/${advisor.id}/${advisor.is_active ? "deactivate" : "activate"}`);
      loadUsers();
    } catch (err: any) {
      setToggleError(err.response?.data?.detail ?? "Could not update this advisor.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <Topbar title="Team" subtitle="Add advisors and see who's on the team." />

      <div className="mb-6 grid grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="dashboard-card p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Add advisor</h2>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-sm font-medium text-gray-700">Temporary password</label>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {atCap && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Maximum of {maxActiveAdvisors} active advisors reached. Deactivate one before adding another.
            </p>
          )}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || atCap}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add advisor"}
          </button>
        </form>

        <div className="dashboard-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Advisors</h2>
            <span className="text-xs font-semibold text-gray-500">
              {activeCount} / {maxActiveAdvisors} active
            </span>
          </div>
          {toggleError && <p className="mb-2 text-xs text-red-600">{toggleError}</p>}
          <div className="flex flex-col divide-y divide-gray-100">
            {advisors.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-ink">{a.name}</span>
                    {!a.is_active && (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{a.email}</div>
                  <div className="text-xs text-gray-400">Joined {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => toggleActive(a)}
                  disabled={togglingId === a.id || (!a.is_active && atCap)}
                  title={!a.is_active && atCap ? `Maximum of ${maxActiveAdvisors} active advisors reached` : undefined}
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    a.is_active
                      ? "border-[#f3c9c5] text-[#cf4e43] hover:bg-[#fdf2f1]"
                      : "border-[#e7e5e4] text-ink hover:bg-surface"
                  }`}
                >
                  {togglingId === a.id ? "..." : a.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            ))}
            {advisors.length === 0 && <p className="text-sm text-gray-400">No advisors yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
