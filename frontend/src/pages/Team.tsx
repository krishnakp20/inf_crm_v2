import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { PasswordInput } from "../components/common/PasswordInput";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { roleLabel } from "../lib/format";
import type { User, UserRole } from "../lib/types";

const CREATABLE_ROLES: UserRole[] = ["supervisor", "advisor", "marketer", "editor"];

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [maxActiveAdvisors, setMaxActiveAdvisors] = useState(10);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("advisor");
  const [newSupervisorId, setNewSupervisorId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<number | null>(null);

  function loadUsers() {
    api.get<User[]>("/users").then((res) => setUsers(res.data));
  }

  useEffect(() => {
    loadUsers();
    api.get<{ max_active_advisors: number }>("/users/limits").then((res) => {
      setMaxActiveAdvisors(res.data.max_active_advisors);
    });
  }, []);

  const supervisors = useMemo(() => users.filter((u) => u.role === "supervisor"), [users]);
  const activeAdvisorCount = users.filter((u) => u.role === "advisor" && u.is_active).length;
  const atCap = role === "advisor" && activeAdvisorCount >= maxActiveAdvisors;

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/users", {
        name,
        email,
        password,
        role,
        supervisor_id: role === "advisor" && newSupervisorId ? Number(newSupervisorId) : null,
      });
      setName("");
      setEmail("");
      setPassword("");
      setNewSupervisorId("");
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(target: User) {
    setToggleError(null);
    setTogglingId(target.id);
    try {
      await api.post(`/users/${target.id}/${target.is_active ? "deactivate" : "activate"}`);
      loadUsers();
    } catch (err: any) {
      setToggleError(err.response?.data?.detail ?? "Could not update this user.");
    } finally {
      setTogglingId(null);
    }
  }

  async function reassignSupervisor(target: User, supervisorId: string) {
    setReassigningId(target.id);
    try {
      await api.patch(`/users/${target.id}`, { supervisor_id: supervisorId ? Number(supervisorId) : null });
      loadUsers();
    } catch (err: any) {
      setToggleError(err.response?.data?.detail ?? "Could not reassign this user.");
    } finally {
      setReassigningId(null);
    }
  }

  return (
    <div>
      <Topbar title="Team" subtitle="Add teammates and see who's on the team." />

      <div className="mb-6 grid grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="dashboard-card p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Add user</h2>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as UserRole);
              setNewSupervisorId("");
            }}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {CREATABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          {role === "advisor" && (
            <>
              <label className="mb-1 block text-sm font-medium text-gray-700">Supervisor · Optional</label>
              <select
                value={newSupervisorId}
                onChange={(e) => setNewSupervisorId(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}
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
              Maximum of {maxActiveAdvisors} active Influencer Agents reached. Deactivate one before adding another.
            </p>
          )}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || atCap}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add user"}
          </button>
        </form>

        <div className="dashboard-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Team members</h2>
            <span className="text-xs font-semibold text-gray-500">
              {activeAdvisorCount} / {maxActiveAdvisors} Influencer Agents active
            </span>
          </div>
          {toggleError && <p className="mb-2 text-xs text-red-600">{toggleError}</p>}
          <div className="flex flex-col divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-ink">{u.name}</span>
                    <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">
                      {roleLabel(u.role)}
                    </span>
                    {!u.is_active && (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-400">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                  {u.role === "advisor" && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">Supervisor:</span>
                      <select
                        value={u.supervisor_id ?? ""}
                        disabled={reassigningId === u.id}
                        onChange={(e) => reassignSupervisor(u, e.target.value)}
                        className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-ink"
                      >
                        <option value="">Unassigned</option>
                        {supervisors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {u.role !== "admin" && (
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={togglingId === u.id || (u.role === "advisor" && !u.is_active && atCap)}
                    title={
                      u.role === "advisor" && !u.is_active && atCap
                        ? `Maximum of ${maxActiveAdvisors} active Influencer Agents reached`
                        : undefined
                    }
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                      u.is_active
                        ? "border-[#f3c9c5] text-[#cf4e43] hover:bg-[#fdf2f1]"
                        : "border-[#e7e5e4] text-ink hover:bg-surface"
                    }`}
                  >
                    {togglingId === u.id ? "..." : u.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-gray-400">No team members yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
