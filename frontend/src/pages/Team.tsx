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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadUsers() {
    api.get<User[]>("/users").then((res) => setUsers(res.data));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

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

  const advisors = users.filter((u) => u.role === "advisor");

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
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add advisor"}
          </button>
        </form>

        <div className="dashboard-card p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Advisors</h2>
          <div className="flex flex-col divide-y divide-gray-100">
            {advisors.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-ink">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.email}</div>
                </div>
                <div className="text-xs text-gray-400">
                  Joined {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {advisors.length === 0 && <p className="text-sm text-gray-400">No advisors yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
