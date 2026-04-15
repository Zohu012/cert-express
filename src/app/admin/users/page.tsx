"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);

    if (password !== confirm) {
      setAddError("Passwords do not match");
      return;
    }

    setAdding(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setAdding(false);

    if (!res.ok) {
      setAddError(data.error || "Failed to create user");
    } else {
      setAddSuccess(true);
      setUsername("");
      setPassword("");
      setConfirm("");
      fetchUsers();
      setTimeout(() => setAddSuccess(false), 3000);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete admin user "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setDeleteError(null);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      setDeleteError(data.error || "Failed to delete user");
    } else {
      fetchUsers();
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Users</h1>

      {/* Current users */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Users</h2>

        {deleteError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {deleteError}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Username</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{u.username}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      disabled={deletingId === u.id}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40"
                    >
                      {deletingId === u.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add user form */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New User</h2>

        <form onSubmit={handleAdd} className="space-y-4">
          {addError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {addError}
            </div>
          )}
          {addSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              User created successfully.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. admin2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat password"
            />
          </div>

          <Button type="submit" disabled={adding}>
            {adding ? "Creating…" : "Create User"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
