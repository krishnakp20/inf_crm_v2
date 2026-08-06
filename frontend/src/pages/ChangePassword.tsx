import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PasswordInput } from "../components/common/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function ChangePassword() {
  const { user, setUser, logout } = useAuth();
  const isForced = user?.must_change_password ?? false;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not change password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-96 dashboard-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold text-brand-600">Sotrue</div>
          <div className="text-xs text-gray-500">Influencer CRM</div>
        </div>
        <h1 className="mb-1 text-base font-semibold text-ink">Set a new password</h1>
        <p className="mb-4 text-sm text-gray-500">
          {isForced
            ? "You're signed in with a temporary password. Choose a new one to continue."
            : "Choose a new password for your account."}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Current password</label>
        <PasswordInput
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
        <PasswordInput
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
        <PasswordInput
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mb-2 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save new password"}
        </button>
        {isForced ? (
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/"
            className="block w-full rounded-md px-3 py-2 text-center text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </Link>
        )}
      </form>
    </div>
  );
}
