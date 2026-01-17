"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Pencil, Trash2, Save, XCircle, MoreHorizontal } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = "user" | "admin" | "superadmin";

type Status = "todo" | "in_progress" | "backlog" | "done" | "canceled";
type Priority = "low" | "medium" | "high";

type Todo = {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  created_at: string;
  user_name: string | null;

  // ✅ NEW
  status: Status;
  priority: Priority;
};

type AdminUser = {
  id: string;
  email: string | null;
  role: Role;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");

  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [loading, setLoading] = useState(false);

  // ✅ Admin panel states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>({});

  // ✅ Filters (Screenshot UI)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  // -------------------- Fetch Todos --------------------
  const fetchTodos = async (userId: string, userRole: Role) => {
    let query = supabase.from("todos").select("*").order("created_at", {
      ascending: false,
    });

    if (userRole === "user") {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setTodos((data as Todo[]) || []);
  };

  // -------------------- Add Todo --------------------
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

      // ✅ default values
      status: "todo",
      priority: "medium",
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    fetchTodos(user.id, role);
  };

  // -------------------- Edit Title --------------------
  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

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

  // -------------------- Update Status --------------------
  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("todos")
      .update({
        status,
        is_done: status === "done",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) fetchTodos(data.user.id, role);
  };

  // -------------------- Update Priority --------------------
  const updatePriority = async (id: string, priority: Priority) => {
    const { error } = await supabase
      .from("todos")
      .update({ priority })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) fetchTodos(data.user.id, role);
  };

  // -------------------- Delete Todo --------------------
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

  // -------------------- Logout --------------------
  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // -------------------- Admin Users --------------------
  const fetchUsers = async (currentRole: Role) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;

    if (!token) {
      alert("No session token found. Please login again.");
      router.replace("/login");
      return;
    }

    const url =
      currentRole === "superadmin"
        ? "/api/superadmin/users"
        : "/api/admin/users";

    const res = await fetch(url, {
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

    const map: Record<string, Role> = {};
    (data.users || []).forEach((u: AdminUser) => {
      map[u.id] = u.role || "user";
    });
    setSelectedRoles(map);
  };

  const updateUserRole = async (userId: string, newRole: Role) => {
    try {
      setRoleLoading(userId);

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      if (!token) {
        alert("No session token found. Please login again.");
        return;
      }

      const url =
        role === "superadmin"
          ? "/api/superadmin/set-role"
          : "/api/admin/set-role";

      const res = await fetch(url, {
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
      fetchUsers(role);
    } finally {
      setRoleLoading(null);
    }
  };

  // -------------------- INIT --------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email || "");

      const userRole = (user.app_metadata?.role as Role) || "user";
      setRole(userRole);

      fetchTodos(user.id, userRole);

      if (userRole === "admin" || userRole === "superadmin") {
        fetchUsers(userRole);
      }
    };

    init();
  }, []);

  // -------------------- Filtered Todos --------------------
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : t.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ? true : t.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [todos, search, statusFilter, priorityFilter]);

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{email}</p>

            <p className="text-sm mt-1">
              Role:{" "}
              <span
                className={`font-semibold ${
                  role === "superadmin"
                    ? "text-purple-600"
                    : role === "admin"
                    ? "text-green-600"
                    : "text-blue-600"
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

        {/* Admin/Superadmin Panel (UNCHANGED) */}
        {(role === "admin" || role === "superadmin") && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>
                {role === "superadmin"
                  ? "Super Admin Panel (Manage Roles)"
                  : "Admin Panel (Manage Roles)"}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users found...</p>
              ) : (
                users.map((u) => {
                  const isTargetSuperadmin = u.role === "superadmin";

                  return (
                    <div
                      key={u.id}
                      className="border rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-sm">
                          {u.email || "No Email"}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.id}</p>

                        <p className="text-xs mt-1">
                          Current Role:{" "}
                          <span className="font-semibold">{u.role}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedRoles[u.id] || u.role}
                          disabled={isTargetSuperadmin}
                          onValueChange={(val) =>
                            setSelectedRoles((prev) => ({
                              ...prev,
                              [u.id]: val as Role,
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
                          disabled={
                            roleLoading === u.id ||
                            isTargetSuperadmin ||
                            (role === "admin" && u.role === "admin")
                          }
                          variant="outline"
                          onClick={() =>
                            updateUserRole(u.id, selectedRoles[u.id] || u.role)
                          }
                        >
                          {roleLoading === u.id ? "Updating..." : "Update"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* ✅ SUPERADMIN => TODOS HIDE */}
        {role !== "superadmin" && (
          <>
            {/* Add Task */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Add Task</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <Input
                  placeholder="Write a task..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 rounded-xl"
                />

                <Button
                  className="w-full rounded-xl"
                  onClick={addTodo}
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add Task"}
                </Button>
              </CardContent>
            </Card>

            {/* Screenshot Style Table */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>
                  {role === "user" ? "Your Tasks" : "All Users Tasks"}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    placeholder="Filter tasks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 rounded-xl w-full sm:max-w-[420px]"
                  />

                  <div className="flex items-center gap-2">
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as any)}
                    >
                      <SelectTrigger className="h-11 rounded-xl w-[160px]">
                        <SelectValue placeholder="+ Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="todo">Todo</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={priorityFilter}
                      onValueChange={(v) => setPriorityFilter(v as any)}
                    >
                      <SelectTrigger className="h-11 rounded-xl w-[160px]">
                        <SelectValue placeholder="+ Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Table */}
                <div className="w-full overflow-auto rounded-xl border bg-background">
                  <table className="w-full min-w-[950px] text-sm">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-4 w-[50px]">
                          <input type="checkbox" className="h-4 w-4" />
                        </th>
                        <th className="p-4 w-[160px]">Task</th>
                        <th className="p-4">Title</th>
                        <th className="p-4 w-[200px]">Status</th>
                        <th className="p-4 w-[160px]">Priority</th>
                        <th className="p-4 w-[60px] text-right"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTodos.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-muted-foreground">
                            No tasks found...
                          </td>
                        </tr>
                      ) : (
                        filteredTodos.map((t) => (
                          <tr
                            key={t.id}
                            className="border-b hover:bg-muted/30 transition"
                          >
                            <td className="p-4">
                              <input type="checkbox" className="h-4 w-4" />
                            </td>

                            <td className="p-4 font-medium text-muted-foreground">
                              TASK-{t.id.slice(0, 4).toUpperCase()}
                            </td>

                            <td className="p-4">
                              {editingId === t.id ? (
                                <div className="flex flex-col gap-2">
                                  <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="h-10 rounded-xl"
                                  />

                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => updateTodoTitle(t.id)}
                                      disabled={loading}
                                      className="rounded-xl"
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      Save
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEdit}
                                      disabled={loading}
                                      className="rounded-xl"
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="font-semibold">{t.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    by {t.user_name || "User"}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="p-4">
                              <Select
                                value={t.status}
                                onValueChange={(val) =>
                                  updateStatus(t.id, val as Status)
                                }
                              >
                                <SelectTrigger className="h-10 rounded-xl w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todo">Todo</SelectItem>
                                  <SelectItem value="in_progress">
                                    In Progress
                                  </SelectItem>
                                  <SelectItem value="backlog">Backlog</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                  <SelectItem value="canceled">Canceled</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>

                            <td className="p-4">
                              <Select
                                value={t.priority}
                                onValueChange={(val) =>
                                  updatePriority(t.id, val as Priority)
                                }
                              >
                                <SelectTrigger className="h-10 rounded-xl w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>

                            <td className="p-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => startEdit(t)}
                                    className="flex items-center gap-2"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => deleteTodo(t.id)}
                                    className="flex items-center gap-2 text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
