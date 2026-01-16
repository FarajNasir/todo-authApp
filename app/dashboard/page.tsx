"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Todo = {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  created_at: string;
  user_name: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  role: "admin" | "user";
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [loading, setLoading] = useState(false);

  // ✅ Admin panel states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // ✅ dropdown selected roles state
  const [selectedRoles, setSelectedRoles] = useState<
    Record<string, "admin" | "user">
  >({});

  // ✅ Fetch Todos (Admin => all, User => own)
  const fetchTodos = async (userId: string, userRole: "admin" | "user") => {
    let query = supabase.from("todos").select("*").order("created_at", {
      ascending: false,
    });

    if (userRole !== "admin") {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setTodos((data as Todo[]) || []);
  };

  // ✅ Add Todo
  const addTodo = async () => {
    if (!title.trim()) return alert("Enter title");

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    const userName =
      user.user_metadata?.name || user.user_metadata?.full_name || "User";

    setLoading(true);

    const { error } = await supabase.from("todos").insert({
      title,
      user_id: user.id,
      user_name: userName,
      is_done: false,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    fetchTodos(user.id, role);
  };

  // ✅ Start Edit
  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  // ✅ Cancel Edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  // ✅ Update Todo Title
  const updateTodoTitle = async (id: string) => {
    if (!editTitle.trim()) return alert("Title required");

    setLoading(true);

    const { error } = await supabase
      .from("todos")
      .update({ title: editTitle })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEdit();

    const { data } = await supabase.auth.getUser();
    if (data.user) fetchTodos(data.user.id, role);
  };

  // ✅ Toggle Done
  const toggleDone = async (todo: Todo) => {
    const { error } = await supabase
      .from("todos")
      .update({ is_done: !todo.is_done })
      .eq("id", todo.id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) fetchTodos(data.user.id, role);
  };

  // ✅ Delete Todo
  const deleteTodo = async (id: string) => {
    const ok = confirm("Delete this todo?");
    if (!ok) return;

    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) fetchTodos(data.user.id, role);
  };

  // ✅ Logout
  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // ✅ Admin: fetch users list
  const fetchUsers = async () => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;

    if (!token) {
      alert("No session token found. Please login again.");
      router.replace("/login");
      return;
    }

    const res = await fetch("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to fetch users");
      return;
    }

    setUsers(data.users || []);

    // ✅ set dropdown state map
    const map: Record<string, "admin" | "user"> = {};
    (data.users || []).forEach((u: AdminUser) => {
      map[u.id] = u.role || "user";
    });
    setSelectedRoles(map);
  };

  // ✅ Admin: update role
  const updateUserRole = async (userId: string, newRole: "admin" | "user") => {
    try {
      setRoleLoading(userId);

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      if (!token) {
        alert("No session token found. Please login again.");
        return;
      }

      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update role");
        return;
      }

      alert("Role updated ✅");
      fetchUsers();
    } finally {
      setRoleLoading(null);
    }
  };

  // ✅ INIT
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email || "");

      const userRole = (user.app_metadata?.role as "admin" | "user") || "user";
      setRole(userRole);

      fetchTodos(user.id, userRole);

      if (userRole === "admin") {
        fetchUsers();
      }
    };

    init();
  }, []);

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{email}</p>

            <p className="text-sm mt-1">
              Role:{" "}
              <span
                className={`font-semibold ${
                  role === "admin" ? "text-green-600" : "text-blue-600"
                }`}
              >
                {role.toUpperCase()}
              </span>
            </p>
          </div>

          <Button variant="destructive" onClick={logout}>
            Logout
          </Button>
        </div>

        {/* Admin Panel */}
        {role === "admin" && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Admin Panel (Manage Roles)</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No users found...
                </p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="border rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {u.email || "No Email"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.id}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedRoles[u.id] || u.role}
                        onValueChange={(val) =>
                          setSelectedRoles((prev) => ({
                            ...prev,
                            [u.id]: val as "admin" | "user",
                          }))
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        disabled={roleLoading === u.id}
                        variant="outline"
                        onClick={() =>
                          updateUserRole(u.id, selectedRoles[u.id] || u.role)
                        }
                      >
                        {roleLoading === u.id ? "Updating..." : "Update"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Todo */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Add Todo</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <Input
              placeholder="Write a todo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Button className="w-full" onClick={addTodo} disabled={loading}>
              {loading ? "Adding..." : "Add Todo"}
            </Button>
          </CardContent>
        </Card>

        {/* Todo List */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>
              {role === "admin" ? "All Users Todos" : "Your Todos"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No todos yet.</p>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className="border bg-background rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  {editingId === todo.id ? (
                    <div className="flex-1 space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Update todo title"
                      />

                      <div className="flex gap-2">
                        <Button
                          className="w-full"
                          onClick={() => updateTodoTitle(todo.id)}
                          disabled={loading}
                        >
                          {loading ? "Saving..." : "Save"}
                        </Button>

                        <Button
                          className="w-full"
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleDone(todo)}
                        className="shrink-0"
                        title="Toggle Done"
                      >
                        {todo.is_done ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground" />
                        )}
                      </button>

                      <div className="flex-1">
                        <p
                          className={`font-semibold text-base ${
                            todo.is_done
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {todo.title}
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                          by {todo.user_name || "User"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(todo)}
                          className="rounded-full"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTodo(todo.id)}
                          className="rounded-full text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
