import { FormEvent, ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { request } from "./api";
import "./index.css";

type EventItem = { id: string; name: string; team_members?: string[] };
type Photo = { id: string; filename: string; storage_url: string };
type AccessRequest = {
  id: string;
  name: string;
  email: string;
  requested_role: "event_manager" | "team_member";
  team_name?: string;
  manager_email?: string;
};
type PublicTeam = { id: string; manager_name: string; manager_email: string; team_name: string };
type TeamMember = { id: string; name: string; email: string; assigned_events?: { id: string; name: string }[] };
type ManagerSummary = { id: string; name: string; email: string; team_name: string; members_count: number; events_count: number };
type User = { id: string; name: string; email: string; role: string; team_name?: string; manager_name?: string };
type Activity = {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  details: string;
  event_id?: string;
  event_name?: string;
  created_at?: string;
};
type ShareInfo = {
  id: string;
  event_id: string;
  slug: string;
  share_url: string;
  pin?: string;
  is_published: boolean;
  photo_count: number;
  created_at?: string;
};

function ActivityTimeline({ activities, title = "Activity History" }: { activities: Activity[]; title?: string }) {
  const getActionBadge = (action: string) => {
    if (action.includes("upload")) return { icon: "📸", color: "bg-teal-100 text-teal-800 border-teal-200" };
    if (action.includes("share") || action.includes("pin")) return { icon: "🔐", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    if (action.includes("guest")) return { icon: "👁️", color: "bg-amber-100 text-amber-800 border-amber-200" };
    if (action.includes("assign") || action.includes("member") || action.includes("invite")) return { icon: "👤", color: "bg-cyan-100 text-cyan-800 border-cyan-200" };
    if (action.includes("event")) return { icon: "🗓️", color: "bg-violet-100 text-violet-800 border-violet-200" };
    return { icon: "⚡", color: "bg-slate-100 text-slate-800 border-slate-200" };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">Live timeline of actions performed across the team</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {activities.length} records
        </span>
      </div>

      <div className="mt-4 divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
        {activities.length > 0 ? (
          activities.map((act) => {
            const badge = getActionBadge(act.action);
            return (
              <div key={act.id} className="flex items-start gap-3.5 py-3 text-sm">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-sm ${badge.color}`}>
                  {badge.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{act.details}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    {act.user_name && <span className="font-medium text-slate-600">{act.user_name}</span>}
                    {act.user_role && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase font-bold text-slate-500">{act.user_role.replace("_", " ")}</span>}
                    <span>•</span>
                    <span>{formatDate(act.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No activity history recorded yet. Uploads, access PIN links, and member assignments will be logged here.
          </div>
        )}
      </div>
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/login" className={`inline-flex items-center gap-3 font-semibold tracking-tight ${light ? "text-white" : "text-slate-950"}`}>
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-500 text-lg font-black text-white shadow-lg shadow-teal-500/30">
        P
      </span>
      <span className="text-xl">
        Prism<span className={light ? "text-teal-200" : "text-teal-600"}>Gallery</span>
      </span>
    </Link>
  );
}

function Notice({ message, tone = "error" }: { message: string; tone?: "error" | "success" }) {
  return message ? (
    <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${tone === "error" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"}`}>
      {message}
    </p>
  ) : null;
}

function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <main className={`mx-auto w-full px-5 sm:px-8 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>{children}</main>;
}

function WorkspaceHeader({ title, subtitle, back }: { title: string; subtitle: string; back?: string }) {
  return (
    <header className="flex flex-col gap-5 border-b border-slate-200/80 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {back ? (
          <Link className="mb-3 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900" to={back}>
            ← Back
          </Link>
        ) : (
          <Brand />
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        className="btn-secondary self-start sm:self-auto"
        onClick={() => {
          localStorage.clear();
          location.href = "/login";
        }}
      >
        Sign out
      </button>
    </header>
  );
}

// ================= AUTH / REGISTRATION =================

function Auth({ requestAccess = false }: { requestAccess?: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [role, setRole] = useState<"event_manager" | "team_member">("event_manager");
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (requestAccess) {
      request("/teams/public")
        .then((data: PublicTeam[]) => {
          setTeams(data);
          if (data.length > 0) setSelectedManagerId(data[0].id);
        })
        .catch(() => {});
    }
  }, [requestAccess]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);

    try {
      if (requestAccess) {
        const payload: Record<string, any> = {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          requested_role: role,
        };
        if (role === "event_manager") {
          payload.team_name = form.get("team_name");
        } else {
          if (selectedManagerId) {
            payload.manager_id = selectedManagerId;
          } else {
            payload.manager_email = form.get("manager_email");
          }
        }
        await request("/access-requests", { method: "POST", body: JSON.stringify(payload) });
        navigate("/request-submitted", {
          state: {
            role,
            name: payload.name,
            email: payload.email,
            team_name: payload.team_name,
          },
        });
        return;
      } else {
        const result = await request("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        });
        localStorage.setItem("token", result.access_token);
        const me = await request("/auth/me");
        if (me.role === "super_admin") navigate("/super/dashboard");
        else if (me.role === "event_manager") navigate("/manager/dashboard");
        else navigate("/team/dashboard");
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
          <Brand light />
          <div className="relative">
            <span className="mb-6 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-100">
              ROLE & TEAM ISOLATION
            </span>
            <h1 className="max-w-md text-5xl font-semibold leading-[1.05] tracking-tight text-white">
              The right studio, in the right team.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Event managers manage their distinct studios, invite members, and isolate events.
              Team members upload exclusively to their assigned events.
            </p>
          </div>
          <div className="relative flex items-center gap-3 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-teal-400" /> Dedicated studio workspaces
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Brand />
            </div>
            {submitted ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-100 text-3xl text-emerald-700">✓</div>
                <p className="mt-8 text-xs font-bold tracking-[.18em] text-teal-700">REQUEST SENT</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Request received.</h1>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {role === "event_manager"
                    ? "Your request has been routed to the Super Admin for profile approval."
                    : "Your request was routed directly to that specific Event Manager. Once approved, you can sign in."}
                </p>
                <Link className="btn-primary mt-8 inline-block" to="/login">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[.18em] text-teal-600">
                  {requestAccess ? "Request access" : "Welcome back"}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {requestAccess ? "Join Prism Gallery" : "Sign in to Prism"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {requestAccess
                    ? "Accounts are routed to the responsible manager for approval."
                    : "Access your studio workspace or team assignments."}
                </p>

                <form className="mt-8 grid gap-4" onSubmit={submit}>
                  {requestAccess && (
                    <>
                      <label className="field-label">
                        Full name
                        <input name="name" placeholder="Alex Morgan" required />
                      </label>
                      <label className="field-label">
                        I am applying as
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value as "event_manager" | "team_member")}
                        >
                          <option value="event_manager">Event Manager (Studio Lead)</option>
                          <option value="team_member">Photography Team Member</option>
                        </select>
                      </label>

                      {role === "event_manager" && (
                        <label className="field-label">
                          Studio / Team Name
                          <input name="team_name" placeholder="e.g. Apex Photo Co." required />
                        </label>
                      )}

                      {role === "team_member" && (
                        <label className="field-label">
                          Select Studio / Event Manager to Join
                          {teams.length > 0 ? (
                            <select
                              value={selectedManagerId}
                              onChange={(e) => setSelectedManagerId(e.target.value)}
                            >
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.team_name} — {t.manager_name} ({t.manager_email})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              name="manager_email"
                              type="email"
                              placeholder="manager@studio.com"
                              required
                            />
                          )}
                          <span className="text-xs font-normal text-slate-500">
                            Notification will go strictly to this studio's Event Manager.
                          </span>
                        </label>
                      )}
                    </>
                  )}

                  <label className="field-label">
                    Email address
                    <input
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label className="field-label">
                    Password
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={requestAccess ? "new-password" : "current-password"}
                    />
                  </label>

                  <button className="btn-primary mt-2 w-full" disabled={busy}>
                    {busy
                      ? "Please wait…"
                      : requestAccess
                      ? role === "event_manager"
                        ? "Send Request to Admin"
                        : "Send Request to Studio Lead"
                      : "Sign in"}
                  </button>
                </form>

                <Notice message={error} />

                <p className="mt-7 text-center text-sm text-slate-500">
                  {requestAccess ? "Already have an account?" : "Need an account or team access?"}{" "}
                  <Link className="font-semibold text-teal-700 hover:text-teal-800" to={requestAccess ? "/login" : "/register"}>
                    {requestAccess ? "Sign in" : "Request access"}
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ================= APPROVAL QUEUE =================

function ApprovalQueue({ title, subtitle }: { title: string; subtitle: string }) {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () =>
    request("/access-requests")
      .then(setItems)
      .catch((reason) => setError((reason as Error).message));

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    try {
      await request(`/access-requests/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-600">APPROVAL QUEUE</p>
          <h2 className="mt-1 text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
          {items.length} Pending
        </span>
      </div>

      <Notice message={error} />
      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 font-bold text-teal-700">
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900">{item.name}</h3>
                    <p className="truncate text-sm text-slate-500">{item.email}</p>
                    {item.team_name && (
                      <p className="mt-1 text-xs font-semibold text-indigo-700">Studio: {item.team_name}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.requested_role === "event_manager"
                        ? "Requesting Event Manager role"
                        : "Requesting to join your team"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  className="btn-primary flex-1 py-2 text-sm"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="btn-secondary flex-1 py-2 text-sm"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, "rejected")}
                >
                  Decline
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            No pending requests in your queue.
          </div>
        )}
      </div>
    </section>
  );
}

// ================= SUPER ADMIN DASHBOARD =================

function SuperDashboard() {
  const [tab, setTab] = useState<"approvals" | "managers" | "invite" | "history">("approvals");
  const [managers, setManagers] = useState<ManagerSummary[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const loadData = () => {
    request("/super/stats").then(setStats).catch(() => {});
    request("/super/managers").then(setManagers).catch(() => {});
    request("/activities").then(setActivities).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  async function inviteManager(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      await request("/super/managers", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          team_name: form.get("team_name"),
          password: form.get("password"),
        }),
      });
      setSuccess("Event manager created and provisioned successfully.");
      formElement.reset();
      loadData();
      setTab("managers");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteManager(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove event manager "${name}"?`)) return;
    try {
      await request(`/super/managers/${id}`, { method: "DELETE" });
      setManagers((cur) => cur.filter((m) => m.id !== id));
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function resetAllUsers() {
    if (!confirm("Are you sure you want to remove all users from the database except the super admin?")) return;
    try {
      const res = await request("/super/reset-users", { method: "POST" });
      setSuccess(res.message || "All users except admin have been removed.");
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Page>
        <WorkspaceHeader
          title="Platform Administration"
          subtitle="Manage event managers, view platform metrics, and oversee studio authorizations."
        />

        {/* STATS BAR */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-slate-900">{stats.managers_count ?? 0}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Managers</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-slate-900">{stats.members_count ?? 0}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Members</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-slate-900">{stats.events_count ?? 0}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Events</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-teal-700">{stats.pending_managers ?? 0}</p>
            <p className="mt-1 text-xs font-semibold text-teal-800 uppercase tracking-wider">Pending Requests</p>
          </div>
        </div>

        {/* TABS */}
        <div className="mt-8 flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
          <div className="flex flex-wrap">
            <button
              onClick={() => setTab("approvals")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${tab === "approvals" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Pending Requests ({stats.pending_managers ?? 0})
            </button>
            <button
              onClick={() => setTab("managers")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${tab === "managers" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              All Event Managers ({managers.length})
            </button>
            <button
              onClick={() => setTab("invite")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${tab === "invite" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              + Direct Invite Manager
            </button>
            <button
              onClick={() => setTab("history")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${tab === "history" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Platform History ({activities.length})
            </button>
          </div>

          <button
            onClick={resetAllUsers}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 self-center py-2 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 transition"
          >
            Reset Database (Admin Only)
          </button>
        </div>

        <Notice message={error} />
        <Notice message={success} tone="success" />

        <div className="py-8">
          {tab === "approvals" && (
            <ApprovalQueue
              title="Event Manager Requests"
              subtitle="Prospective studio leads requesting permission to create workspaces on Prism."
            />
          )}

          {tab === "managers" && (
            <section className="card p-6">
              <h2 className="text-lg font-bold text-slate-900">Registered Event Managers & Studios</h2>
              <p className="mt-1 text-sm text-slate-500">Each event manager operates an isolated studio and team.</p>
              <div className="mt-5 grid gap-4">
                {managers.length ? (
                  managers.map((m) => (
                    <article
                      key={m.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 font-bold text-teal-700">
                            {m.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900">{m.name}</h3>
                            <p className="text-sm text-slate-500">{m.email}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-md bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                            Studio: {m.team_name}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                            {m.members_count} Team Members
                          </span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                            {m.events_count} Events
                          </span>
                        </div>
                      </div>
                      <button
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        onClick={() => deleteManager(m.id, m.name)}
                      >
                        Remove Manager
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">No event managers registered yet.</p>
                )}
              </div>
            </section>
          )}

          {tab === "invite" && (
            <section className="card mx-auto max-w-xl p-8">
              <h2 className="text-xl font-bold text-slate-900">Directly Provision an Event Manager</h2>
              <p className="mt-1 text-sm text-slate-500">
                Immediately create an event manager account without requiring an access request.
              </p>
              <form className="mt-6 grid gap-4" onSubmit={inviteManager}>
                <label className="field-label">
                  Manager Full Name
                  <input name="name" placeholder="Samantha Bell" required />
                </label>
                <label className="field-label">
                  Studio / Team Name
                  <input name="team_name" placeholder="Velvet Lens Studio" required />
                </label>
                <label className="field-label">
                  Email Address
                  <input name="email" type="email" placeholder="manager@velvetlens.com" required />
                </label>
                <label className="field-label">
                  Initial Password
                  <input name="password" type="password" minLength={8} placeholder="At least 8 characters" required />
                </label>
                <button className="btn-primary mt-2" disabled={busy}>
                  {busy ? "Provisioning…" : "Create Event Manager Account"}
                </button>
              </form>
            </section>
          )}

          {tab === "history" && (
            <ActivityTimeline activities={activities} title="Platform-wide Activity Audit Trail" />
          )}
        </div>
      </Page>
    </div>
  );
}

// ================= EVENT MANAGER DASHBOARD =================

function Dashboard({ manager }: { manager: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(0);
  const [activeTab, setActiveTab] = useState<"events" | "team" | "history">("events");
  const [activities, setActivities] = useState<Activity[]>([]);

  // Direct invite member modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadData = () => {
    request("/auth/me").then(setUser).catch(() => {});
    request("/events").then(setEvents).catch((err) => setError((err as Error).message)).finally(() => setLoading(false));
    request("/activities").then(setActivities).catch(() => {});
    if (manager) {
      request("/notifications").then((res) => setPending(res.pending_access_requests)).catch(() => {});
      request("/manager/team").then(setTeamMembers).catch(() => {});
    }
  };

  useEffect(() => {
    loadData();
  }, [manager]);

  async function addEvent(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const item = await request("/events", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setEvents([item, ...events]);
      setName("");
      setSuccess(`Event "${item.name}" created successfully!`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function directInviteMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await request("/manager/team/invite", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setSuccess("Team member directly added to your studio.");
      setInviteModal(false);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInviteBusy(false);
    }
  }

  async function removeTeamMember(id: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from your studio team?`)) return;
    try {
      await request(`/manager/team/${id}`, { method: "DELETE" });
      setTeamMembers((cur) => cur.filter((m) => m.id !== id));
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Page>
        <WorkspaceHeader
          title={
            manager
              ? `${user?.team_name || "Event Manager"} Workspace`
              : `Photography Team Workspace`
          }
          subtitle={
            manager
              ? `Studio Lead: ${user?.name} · Create events, invite team members, and curate galleries.`
              : `Member of ${user?.team_name || "Assigned Studio"} (Lead: ${user?.manager_name || "Manager"}) · Upload photos to your assigned events.`
          }
        />

        {/* MANAGER NOTIFICATION ALERT FOR TEAM JOIN REQUESTS */}
        {manager && pending > 0 && (
          <Link
            className="mt-5 flex items-center justify-between rounded-2xl bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100/80"
            to="/manager/requests"
          >
            <span>✦ {pending} photographer {pending === 1 ? "request" : "requests"} specifically waiting to join your studio team</span>
            <span className="font-bold underline">Review Requests →</span>
          </Link>
        )}

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("events")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "events" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {manager ? `Events (${events.length})` : `Assigned Events (${events.length})`}
          </button>
          {manager && (
            <button
              onClick={() => setActiveTab("team")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "team" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              My Studio Team ({teamMembers.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab("history")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "history" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Activity History ({activities.length})
          </button>
        </div>

        <Notice message={error} />
        <Notice message={success} tone="success" />

        {/* TAB 1: EVENTS */}
        {(!manager || activeTab === "events") && (
          <section className="grid gap-6 py-8 lg:grid-cols-[1fr_280px]">
            <div>
              {manager && (
                <div className="mb-6 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-600 p-6 text-white shadow-xl shadow-teal-900/10">
                  <p className="text-sm font-semibold text-teal-100">NEW EVENT</p>
                  <form onSubmit={addEvent} className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      className="border-white/30 bg-white text-slate-900 placeholder:text-slate-400 font-medium rounded-xl py-2.5 px-4 flex-1 shadow-xs"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sam & Jordan’s Wedding"
                      required
                    />
                    <button
                      type="submit"
                      className="btn-primary bg-slate-950 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl shrink-0 transition shadow-md"
                      disabled={creating || !name.trim()}
                    >
                      {creating ? "Creating…" : "+ Create Event"}
                    </button>
                  </form>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900">{manager ? "Studio Events" : "Your Assigned Events"}</h2>
                <p className="text-sm text-slate-500">
                  {events.length} {events.length === 1 ? "event" : "events"} available
                </p>
              </div>

              {loading ? (
                <div className="card p-8 text-sm text-slate-500">Loading your events…</div>
              ) : events.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {events.map((item, index) => (
                    <Link
                      className="event-card group"
                      key={item.id}
                      to={`/${manager ? "manager" : "team"}/events/${item.id}${manager ? "" : "/upload"}`}
                    >
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-bold ${index % 2 ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700"}`}
                      >
                        {item.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {manager ? "Assign team & curate gallery" : "Upload photos"}
                        </p>
                      </div>
                      <span className="ml-auto text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="card empty-state">
                  <div className="text-3xl">✦</div>
                  <h3>{manager ? "Create your first event" : "No assigned events yet"}</h3>
                  <p>
                    {manager
                      ? "Create an event, then assign approved photographers from your team to upload."
                      : "Your studio manager has not assigned you to any events yet."}
                  </p>
                </div>
              )}
            </div>

            <aside className="card h-fit p-6">
              <p className="text-xs font-bold tracking-[.16em] text-teal-600">HOW IT WORKS</p>
              <ol className="mt-5 grid gap-5 text-sm">
                <li>
                  <b>01</b>
                  <span>{manager ? "Approve requests or directly invite members to your studio." : "Select an assigned event."}</span>
                </li>
                <li>
                  <b>02</b>
                  <span>{manager ? "Assign team members to specific events." : "Upload high-res event photos."}</span>
                </li>
                <li>
                  <b>03</b>
                  <span>{manager ? "Curate selections and publish a PIN-protected gallery." : "Your manager publishes the private gallery."}</span>
                </li>
              </ol>
            </aside>
          </section>
        )}

        {/* TAB 2: STUDIO TEAM MEMBERS */}
        {manager && activeTab === "team" && (
          <section className="py-8">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Studio Photography Team</h2>
                <p className="text-sm text-slate-500">
                  Members belong exclusively to your studio. You can assign them to events.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to="/manager/requests" className="btn-secondary text-sm">
                  Review Pending Requests ({pending})
                </Link>
                <button className="btn-primary text-sm" onClick={() => setInviteModal(true)}>
                  + Invite Team Member
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teamMembers.length ? (
                teamMembers.map((member) => (
                  <article key={member.id} className="card p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 font-bold text-teal-700">
                          {member.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <h3 className="font-bold text-slate-900">{member.name}</h3>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                      <button
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                        onClick={() => removeTeamMember(member.id, member.name)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-slate-400">Assigned Events:</p>
                      {member.assigned_events && member.assigned_events.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.assigned_events.map((ev) => (
                            <span key={ev.id} className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                              {ev.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Not assigned to any events yet.</p>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="card col-span-full p-8 text-center text-sm text-slate-500">
                  No photographers in your studio yet. Invite members directly or approve pending requests.
                </div>
              )}
            </div>

            {/* DIRECT INVITE MODAL */}
            {inviteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
                <div className="card w-full max-w-md p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Directly Add Team Member</h3>
                    <button className="text-slate-400 hover:text-slate-700" onClick={() => setInviteModal(false)}>
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Immediately provision a photographer account for your studio team.
                  </p>
                  <form className="mt-5 grid gap-4" onSubmit={directInviteMember}>
                    <label className="field-label">
                      Photographer Full Name
                      <input name="name" placeholder="Jordan Lee" required />
                    </label>
                    <label className="field-label">
                      Photographer Email
                      <input name="email" type="email" placeholder="jordan@example.com" required />
                    </label>
                    <label className="field-label">
                      Initial Password
                      <input name="password" type="password" minLength={8} placeholder="At least 8 characters" required />
                    </label>
                    <div className="mt-2 flex gap-3">
                      <button className="btn-primary flex-1" disabled={inviteBusy}>
                        {inviteBusy ? "Adding…" : "Add to Team"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setInviteModal(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: ACTIVITY HISTORY */}
        {activeTab === "history" && (
          <section className="py-8">
            <ActivityTimeline
              activities={activities}
              title={manager ? `${user?.team_name || "Studio"} Activity History` : "Your Team Activity History"}
            />
          </section>
        )}
      </Page>
    </div>
  );
}

// ================= MANAGER TEAM REQUESTS QUEUE =================

function ManagerRequests() {
  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Page narrow>
        <div className="py-6">
          <WorkspaceHeader
            title="Studio Join Requests"
            subtitle="Only photographers requesting to join your particular studio appear here."
            back="/manager/dashboard"
          />
          <div className="py-7">
            <ApprovalQueue
              title="Team Join Requests"
              subtitle="Approving grants access to your studio. You can then assign them to events."
            />
          </div>
        </div>
      </Page>
    </div>
  );
}

// ================= EVENT MANAGER CURATE & ASSIGN VIEW =================

function EventManager() {
  const { id } = useParams();
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [gallery, setGallery] = useState<ShareInfo | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<"curate" | "history">("curate");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Member assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<TeamMember[]>([]);

  const load = () => {
    request(`/events/${id}`).then(setEventData).catch(() => {});
    request(`/events/${id}/photos`).then(setPhotos).catch((reason) => setError((reason as Error).message));
    request("/manager/team").then(setTeamMembers).catch(() => {});
    request(`/events/${id}/members`).then(setAssignedMembers).catch(() => {});
    request(`/events/${id}/gallery`)
      .then((res: ShareInfo | null) => {
        if (res) {
          setGallery(res);
          if (res.pin) setPin(res.pin);
        }
      })
      .catch(() => {});
    request(`/activities?event_id=${id}`).then(setActivities).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [id]);

  function toggle(photoId: string) {
    setChosen((current) =>
      current.includes(photoId) ? current.filter((item) => item !== photoId) : [...current, photoId]
    );
  }

  function generateRandomPin(digits = 6) {
    if (digits === 4) {
      setPin(Math.floor(1000 + Math.random() * 9000).toString());
    } else {
      setPin(Math.floor(100000 + Math.random() * 900000).toString());
    }
  }

  async function toggleMemberAssignment(member: TeamMember) {
    const isAssigned = assignedMembers.some((m) => m.id === member.id);
    setBusy(true);
    try {
      if (isAssigned) {
        await request(`/events/${id}/members/${member.id}`, { method: "DELETE" });
        setAssignedMembers((cur) => cur.filter((m) => m.id !== member.id));
        setNotice(`Unassigned ${member.name} from this event.`);
      } else {
        await request(`/events/${id}/members`, { method: "POST", body: JSON.stringify({ email: member.email }) });
        setAssignedMembers([...assignedMembers, member]);
        setNotice(`Assigned ${member.name} to this event.`);
      }
      request(`/activities?event_id=${id}`).then(setActivities).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateShareLink() {
    if (!pin || pin.length < 4 || pin.length > 8 || !/^\d{4,8}$/.test(pin)) {
      setError("Please specify a 4 to 8-digit access PIN code (e.g. 482917)");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result: ShareInfo = await request(`/events/${id}/share-link`, {
        method: "POST",
        body: JSON.stringify({
          pin,
          photo_ids: chosen.length ? chosen : undefined,
        }),
      });
      setGallery(result);
      setNotice(`Share link active! Access PIN: ${pin}`);
      load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDirectUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const input = formElement.elements.namedItem("files") as HTMLInputElement;
    if (!input?.files?.length) return;
    setUploadBusy(true);
    setError("");
    setNotice("");
    try {
      for (let i = 0; i < input.files.length; i++) {
        const form = new FormData();
        form.append("file", input.files[i]);
        await request(`/events/${id}/photos`, { method: "POST", body: form });
      }
      setNotice(`Uploaded ${input.files.length} photo(s) successfully!`);
      formElement.reset();
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Page>
        <WorkspaceHeader
          title={eventData ? eventData.name : "Event Management"}
          subtitle="Assign studio team members, upload photos, set access PIN, and share with guests."
          back="/manager/dashboard"
        />

        {/* SUB-NAVIGATION TABS */}
        <div className="mt-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("curate")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "curate" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Photos & Sharing ({photos.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "history" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Event Activity History ({activities.length})
          </button>
        </div>

        <Notice message={error} />
        <Notice message={notice} tone="success" />

        {activeTab === "history" ? (
          <section className="py-8">
            <ActivityTimeline activities={activities} title={`History for ${eventData?.name || "this event"}`} />
          </section>
        ) : (
          <section className="grid gap-7 py-8 lg:grid-cols-[1fr_360px]">
            <div>
              {/* DIRECT PHOTO UPLOAD */}
              <div className="card mb-6 p-5">
                <h3 className="text-sm font-bold text-slate-900">Upload Photos directly to Event</h3>
                <p className="text-xs text-slate-500">Add photos to this event alongside your team members.</p>
                <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleDirectUpload}>
                  <input
                    name="files"
                    type="file"
                    accept="image/*"
                    multiple
                    required
                    className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-700"
                  />
                  <button className="btn-primary text-xs shrink-0" disabled={uploadBusy}>
                    {uploadBusy ? "Uploading…" : "+ Upload"}
                  </button>
                </form>
              </div>

              {/* PHOTO SELECTION */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Event Photos ({photos.length})</h2>
                  <p className="text-xs text-slate-500">
                    {chosen.length
                      ? `${chosen.length} of ${photos.length} specifically selected for gallery`
                      : `All ${photos.length} photos will be included in the shared link`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary py-1.5 text-xs"
                    onClick={() => setChosen(photos.map((p) => p.id))}
                    disabled={!photos.length}
                  >
                    Select All
                  </button>
                  <button
                    className="btn-secondary py-1.5 text-xs"
                    onClick={() => setChosen([])}
                    disabled={!chosen.length}
                  >
                    Clear Filter
                  </button>
                </div>
              </div>

              {photos.length ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {photos.map((photo) => (
                    <button
                      type="button"
                      aria-pressed={chosen.includes(photo.id)}
                      className={`photo-tile ${chosen.includes(photo.id) ? "selected" : ""}`}
                      onClick={() => toggle(photo.id)}
                      key={photo.id}
                    >
                      <img src={photo.storage_url} alt={photo.filename} />
                      <span className="photo-check">{chosen.includes(photo.id) ? "✓" : "+"}</span>
                      <span className="photo-name">{photo.filename}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card empty-state">
                  <div className="text-3xl">▧</div>
                  <h3>No photos uploaded yet</h3>
                  <p>Upload photos directly above or assign studio photographers below to contribute.</p>
                </div>
              )}
            </div>

            {/* ASIDE: 4-DIGIT PIN SHARING & TEAM ASSIGNMENT */}
            <aside className="grid h-fit gap-5">
              {/* ACCESS PIN & SHARE LINK PORTAL */}
              <section className="card p-6 border-teal-200/80 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-100 text-sm font-bold text-teal-700">
                    🔐
                  </span>
                  <div>
                    <p className="text-[11px] font-bold tracking-[.16em] text-teal-600">CLIENT ACCESS CREDENTIALS</p>
                    <h3 className="text-base font-bold text-slate-900">PIN-Protected Gallery Link</h3>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Generate a private shareable link protected by an access PIN (4–8 digits, e.g. 482917). Guests enter this PIN to unlock and view photos.
                </p>

                {gallery ? (
                  <div className="mt-4 rounded-2xl bg-teal-50/80 p-4 border border-teal-200">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                        ACTIVE SHARE LINK
                      </span>
                      <span className="text-xs font-bold text-slate-500">PIN: <strong className="font-mono text-teal-900 text-sm tracking-widest">{gallery.pin || pin || "••••••"}</strong></span>
                    </div>

                    <p className="mt-2.5 break-all font-mono text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-teal-100">
                      {gallery.share_url}
                    </p>

                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        className="btn-primary py-2 text-xs w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(gallery.share_url);
                          setNotice("Share link copied to clipboard!");
                        }}
                      >
                        Copy Share Link
                      </button>
                      <button
                        className="btn-secondary py-2 text-xs w-full"
                        onClick={() => {
                          const invite = `View photos from "${eventData?.name}": ${gallery.share_url}\nAccess PIN: ${gallery.pin || pin}`;
                          navigator.clipboard.writeText(invite);
                          setNotice("Full invite message with PIN copied!");
                        }}
                      >
                        Copy Full Invite with PIN
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* PIN INPUT / UPDATE FORM */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="field-label">
                    <span>{gallery ? "Update Access PIN (4–8 Digits)" : "Set Access PIN (4–8 Digits)"}</span>
                    <div className="flex gap-2">
                      <input
                        value={pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                          setPin(val);
                        }}
                        placeholder="e.g. 482917"
                        maxLength={8}
                        inputMode="numeric"
                        pattern="\d{4,8}"
                        className="font-mono text-center tracking-[.3em] font-bold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => generateRandomPin(6)}
                        className="btn-secondary text-xs px-2.5 shrink-0"
                        title="Generate 6-digit PIN"
                      >
                        6-Digit
                      </button>
                      <button
                        type="button"
                        onClick={() => generateRandomPin(4)}
                        className="btn-secondary text-xs px-2.5 shrink-0"
                        title="Generate 4-digit PIN"
                      >
                        4-Digit
                      </button>
                    </div>
                  </label>

                  <button
                    className="btn-primary mt-3 w-full"
                    disabled={pin.length < 4 || pin.length > 8 || busy}
                    onClick={generateShareLink}
                  >
                    {busy ? "Saving…" : gallery ? "Update PIN & Share Link" : "Publish Gallery & Generate Link"}
                  </button>
                </div>
              </section>

              {/* ASSIGNED TEAM MEMBERS */}
              <section className="card p-6">
                <p className="text-xs font-bold tracking-[.16em] text-teal-600">STUDIO PHOTOGRAPHERS</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Assign Photographers</h3>
                <p className="mt-1 text-xs text-slate-500">Assigned team members can upload photos and share this event.</p>

                <div className="mt-4 grid gap-2">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => {
                      const assigned = assignedMembers.some((m) => m.id === member.id);
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between rounded-xl border p-2.5 transition ${assigned ? "border-teal-300 bg-teal-50/50" : "border-slate-200 bg-white"}`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate text-xs font-bold text-slate-900">{member.name}</p>
                            <p className="truncate text-[11px] text-slate-500">{member.email}</p>
                          </div>
                          <button
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${assigned ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "bg-teal-700 text-white hover:bg-teal-800"}`}
                            onClick={() => toggleMemberAssignment(member)}
                            disabled={busy}
                          >
                            {assigned ? "Remove" : "+ Assign"}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400">No studio members yet. Add members in your dashboard first.</p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        )}
      </Page>
    </div>
  );
}

// ================= TEAM MEMBER UPLOAD =================

function Upload() {
  const { id } = useParams();
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [myPhotos, setMyPhotos] = useState<Photo[]>([]);
  const [gallery, setGallery] = useState<ShareInfo | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<"workspace" | "history">("workspace");
  const [photoFilter, setPhotoFilter] = useState<"all" | "mine">("mine");
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  const load = () => {
    request(`/events/${id}`).then(setEventData).catch(() => {});
    request(`/events/${id}/photos`).then(setAllPhotos).catch(() => {});
    request(`/events/${id}/photos?mine=true`).then(setMyPhotos).catch(() => {});
    request(`/events/${id}/gallery`)
      .then((res: ShareInfo | null) => {
        if (res) setGallery(res);
      })
      .catch(() => {});
    request(`/activities?event_id=${id}`).then(setActivities).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [id]);

  async function handleMultiUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    if (!selectedFiles.length) return;
    setBusy(true);
    setError("");
    setMessage("");

    let successCount = 0;
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}: "${selectedFiles[i].name}"…`);
        const form = new FormData();
        form.append("file", selectedFiles[i]);
        await request(`/events/${id}/photos`, { method: "POST", body: form });
        successCount++;
      }
      setMessage(`Successfully uploaded ${successCount} photo${successCount === 1 ? "" : "s"}!`);
      setSelectedFiles([]);
      setUploadProgress("");
      formElement.reset();
      load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
      setUploadProgress("");
    }
  }

  const displayedPhotos = photoFilter === "mine" ? myPhotos : allPhotos;

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Page>
        <div className="py-6">
          <WorkspaceHeader
            title={eventData ? eventData.name : "Event Workspace"}
            subtitle="Collaboratively upload event photos, review your contributions, and monitor event activity."
            back="/team/dashboard"
          />

          {/* SUB-TABS */}
          <div className="mt-6 flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("workspace")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "workspace" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Upload & Share Link
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "history" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              Event Activity History ({activities.length})
            </button>
          </div>

          <Notice message={message} tone="success" />
          <Notice message={error} />

          {activeTab === "history" ? (
            <section className="py-8">
              <ActivityTimeline activities={activities} title={`History for ${eventData?.name || "this event"}`} />
            </section>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* LEFT COLUMN: MULTI-PHOTO UPLOAD & GALLERY */}
              <div>
                {/* UPLOAD PORTAL */}
                <section className="card overflow-hidden shadow-md">
                  <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-6 text-white">
                    <p className="text-xs font-bold tracking-[.16em] text-teal-100">EVENT PHOTOGRAPHER PORTAL</p>
                    <h2 className="mt-1 text-2xl font-bold">{eventData?.name || "Upload Moments"}</h2>
                    <p className="mt-1 text-xs text-teal-50">
                      Select one or multiple photos to upload into this event.
                    </p>
                  </div>

                  <form className="p-6" onSubmit={handleMultiUpload}>
                    <label className="upload-zone">
                      <input
                        name="files"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            setSelectedFiles(Array.from(e.target.files));
                          }
                        }}
                      />
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100 text-2xl text-teal-700">
                        ↑
                      </span>
                      <span className="mt-3 font-bold text-slate-900">
                        {selectedFiles.length
                          ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected`
                          : "Choose or drag photos to upload"}
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        JPG, PNG, WebP · Select multiple photos at once
                      </span>
                    </label>

                    {/* SELECTED FILES LIST */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>Selected Photos ({selectedFiles.length})</span>
                          <button
                            type="button"
                            className="text-rose-600 hover:underline"
                            onClick={() => setSelectedFiles([])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="mt-2 max-h-32 overflow-y-auto divide-y divide-slate-200/60 text-xs text-slate-600">
                          {selectedFiles.map((f, i) => (
                            <div key={i} className="py-1 flex justify-between">
                              <span className="truncate max-w-[240px]">{f.name}</span>
                              <span className="text-slate-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadProgress && (
                      <div className="mt-3 rounded-xl bg-cyan-50 p-3 text-xs font-semibold text-cyan-800 animate-pulse border border-cyan-200">
                        {uploadProgress}
                      </div>
                    )}

                    <button
                      className="btn-primary mt-4 w-full py-3"
                      disabled={!selectedFiles.length || busy}
                    >
                      {busy ? "Uploading Photos…" : `Upload ${selectedFiles.length ? selectedFiles.length : ""} Photo${selectedFiles.length === 1 ? "" : "s"}`}
                    </button>
                  </form>
                </section>

                {/* PHOTO GALLERY EXPLORER */}
                <section className="mt-10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Event Photos</h3>
                      <p className="text-xs text-slate-500">
                        {displayedPhotos.length} {displayedPhotos.length === 1 ? "photo" : "photos"} in this view
                      </p>
                    </div>

                    <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                      <button
                        onClick={() => setPhotoFilter("all")}
                        className={`rounded-lg px-3 py-1.5 transition ${photoFilter === "all" ? "bg-white text-teal-800 shadow-xs" : "text-slate-500 hover:text-slate-900"}`}
                      >
                        All Event Photos ({allPhotos.length})
                      </button>
                      <button
                        onClick={() => setPhotoFilter("mine")}
                        className={`rounded-lg px-3 py-1.5 transition ${photoFilter === "mine" ? "bg-white text-teal-800 shadow-xs" : "text-slate-500 hover:text-slate-900"}`}
                      >
                        My Uploads ({myPhotos.length})
                      </button>
                    </div>
                  </div>

                  {displayedPhotos.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {displayedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                          onClick={() => setPreviewPhoto(photo)}
                        >
                          <img
                            src={photo.storage_url}
                            alt={photo.filename}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 flex items-end p-2.5">
                            <p className="truncate text-[11px] font-semibold text-white">{photo.filename}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card empty-state mt-4">
                      <div className="text-3xl">▧</div>
                      <h3>No photos yet</h3>
                      <p>Use the upload box above to upload photos into this event.</p>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT COLUMN: EVENT GALLERY STATUS & ROLE INFO */}
              <aside className="grid h-fit gap-6">
                <section className="card p-6 border-teal-200/90 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-100 text-base font-bold text-teal-700">
                      🖼️
                    </span>
                    <div>
                      <p className="text-[11px] font-bold tracking-[.16em] text-teal-600">CLIENT GALLERY STATUS</p>
                      <h3 className="text-lg font-bold text-slate-900">Event Gallery</h3>
                    </div>
                  </div>

                  {/* ACTIVE SHARE LINK DETAILS IF PUBLISHED BY LEAD */}
                  {gallery?.is_published ? (
                    <div className="mt-4 rounded-2xl bg-teal-50/90 p-4 border border-teal-200">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                          PUBLISHED BY LEAD
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {gallery.photo_count} photos curated
                        </span>
                      </div>

                      <div className="mt-3 bg-white p-2.5 rounded-xl border border-teal-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Customer Link</p>
                        <p className="mt-0.5 break-all font-mono text-xs text-slate-800">{gallery.share_url}</p>
                      </div>

                      <button
                        className="btn-primary mt-3 py-2 text-xs w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(gallery.share_url);
                          setMessage("Gallery link copied to clipboard!");
                        }}
                      >
                        📋 Copy Customer Link
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500 text-center">
                        Gallery PIN & curated selections are managed by your Event Lead.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                        AWAITING CURATION
                      </span>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        Once all photographer uploads are in, your Event Lead will consolidate, review, and select photos to publish the official PIN-protected gallery.
                      </p>
                    </div>
                  )}

                  {/* CONTRIBUTION METRICS */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Your Contributions</h4>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-teal-50/60 p-3 text-center border border-teal-100">
                        <p className="text-xl font-extrabold text-teal-800">{myPhotos.length}</p>
                        <p className="text-[11px] text-slate-500 font-medium">My Uploads</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
                        <p className="text-xl font-extrabold text-slate-800">{allPhotos.length}</p>
                        <p className="text-[11px] text-slate-500 font-medium">Total Uploads</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* TEAM MEMBER WORKFLOW GUIDE */}
                <section className="card p-5 bg-gradient-to-br from-slate-50 to-teal-50/40">
                  <h4 className="text-xs font-bold text-slate-800">Photographer Team Role:</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                    <li>Upload raw & edited event photos directly to this workspace.</li>
                    <li>Switch to "My Uploads" anytime to review your uploaded photos.</li>
                    <li>Only the Admin/Lead can curate selections and publish the gallery.</li>
                  </ul>
                </section>
              </aside>
            </div>
          )}

          {/* LIGHTBOX MODAL */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
              onClick={() => setPreviewPhoto(null)}
            >
              <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-slate-900 p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <img
                  src={previewPhoto.storage_url}
                  alt={previewPhoto.filename}
                  className="max-h-[80vh] w-auto rounded-xl object-contain"
                />
                <div className="mt-2 flex items-center justify-between px-2 text-xs text-white">
                  <span className="font-semibold">{previewPhoto.filename}</span>
                  <div className="flex gap-3">
                    <a
                      href={previewPhoto.storage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400 hover:underline font-bold"
                    >
                      Open Original ↗
                    </a>
                    <button onClick={() => setPreviewPhoto(null)} className="text-slate-400 hover:text-white">
                      ✕ Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Page>
    </div>
  );
}

// ================= PUBLIC GUEST GALLERY (PIN-ONLY) =================

function PublicGallery() {
  const { slug } = useParams();
  const [pin, setPin] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [eventInfo, setEventInfo] = useState<{ name: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);

  async function access(e: FormEvent) {
    e.preventDefault();
    if (!pin || pin.length < 4 || pin.length > 8) {
      setError("Please enter your access PIN (4–8 digits, e.g. 482917)");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await request(`/gallery/${slug}/access`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      setPhotos(result.photos);
      if (result.event) setEventInfo(result.event);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (photos.length) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Page>
          <header className="flex items-center justify-between py-7 border-b border-white/10">
            <Brand light />
            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-300">
              🔒 PIN PROTECTED GALLERY
            </span>
          </header>

          <section className="py-10">
            <p className="text-sm font-semibold tracking-[.18em] text-teal-400">
              {eventInfo ? eventInfo.name.toUpperCase() : "EVENT MOMENTS"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Made to be remembered.</h1>
            <p className="mt-2 text-sm text-slate-400">{photos.length} captured moments</p>

            <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative mb-4 cursor-pointer overflow-hidden rounded-2xl border border-white/10 break-inside-avoid shadow-xl transition duration-200 hover:border-teal-400/50"
                  onClick={() => setActivePhoto(photo)}
                >
                  <img
                    className="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    src={photo.storage_url}
                    alt={photo.filename}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 flex items-end justify-between p-4">
                    <span className="truncate text-xs font-medium text-slate-200">{photo.filename}</span>
                    <a
                      href={photo.storage_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-teal-500 shrink-0"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* LIGHTBOX FOR PUBLIC GALLERY */}
          {activePhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
              onClick={() => setActivePhoto(null)}
            >
              <div className="relative max-h-[95vh] max-w-5xl overflow-hidden rounded-2xl bg-slate-900 p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <img
                  src={activePhoto.storage_url}
                  alt={activePhoto.filename}
                  className="max-h-[85vh] w-auto rounded-xl object-contain"
                />
                <div className="mt-3 flex items-center justify-between px-3 text-xs text-white">
                  <span className="font-semibold text-slate-300">{activePhoto.filename}</span>
                  <div className="flex gap-4">
                    <a
                      href={activePhoto.storage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-teal-600 px-3 py-1 font-bold text-white hover:bg-teal-500"
                    >
                      Download Original
                    </a>
                    <button onClick={() => setActivePhoto(null)} className="text-slate-400 hover:text-white text-sm">
                      ✕ Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Page>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,_#99f6e4,_#f8fafc_40%,_#e0e7ff)] p-5">
      <section className="card w-full max-w-md p-8 text-center sm:p-10 shadow-xl border-teal-100">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-950 text-2xl text-white shadow-xl">
          🔐
        </div>
        <p className="mt-7 text-xs font-bold tracking-[.18em] text-teal-700">PRIVATE GUEST REVEAL</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Your Gallery is Ready</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Enter the access PIN provided by your event photographer or host (e.g. 482917) to unlock your photos.
        </p>

        <form className="mt-7 grid gap-3" onSubmit={access}>
          <input
            className="text-center text-2xl tracking-[.4em] font-mono font-black text-slate-900 py-3"
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 8);
              setPin(val);
            }}
            placeholder="••••••"
            maxLength={8}
            inputMode="numeric"
            pattern="\d{4,8}"
            aria-label="Gallery Access PIN"
            autoFocus
          />
          <button className="btn-primary py-3 font-bold" disabled={pin.length < 4 || pin.length > 8 || busy}>
            {busy ? "Unlocking…" : "Unlock Gallery"}
          </button>
        </form>

        <Notice message={error} />
        <p className="mt-6 text-xs text-slate-400">Protected with PIN security</p>
      </section>
    </div>
  );
}

// ================= REQUEST SUBMITTED CONFIRMATION PAGE =================

function RequestSubmittedPage() {
  const location = useLocation();
  const state = (location.state as { role?: string; name?: string; email?: string; team_name?: string }) || {};
  const isManager = state.role !== "team_member";

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.05fr_.95fr]">
        {/* Left Side: Brand Gradient Matching Sign In */}
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
          <Brand light />
          <div className="relative">
            <span className="mb-6 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-100">
              APPROVAL PIPELINE
            </span>
            <h1 className="max-w-md text-5xl font-semibold leading-[1.05] tracking-tight text-white">
              Your workspace is almost ready.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Each studio workspace is privately reviewed and approved before activation to ensure complete security and role isolation.
            </p>
          </div>
          <div className="relative flex items-center gap-3 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            Verification in progress
          </div>
        </section>

        {/* Right Side: Clean White Card Matching Sign In */}
        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
          <div className="w-full max-w-md py-6 text-center">
            <div className="mb-8 flex justify-center lg:hidden">
              <Brand />
            </div>

            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-50 text-4xl text-emerald-600 ring-8 ring-emerald-50/50 shadow-inner">
              ✓
            </div>

            <p className="mt-7 text-xs font-bold tracking-[.18em] text-teal-600 uppercase">
              Request Sent Successfully
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Your request has been sent!
            </h1>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {isManager ? (
                <>
                  Please wait for a few minutes. The <strong className="font-semibold text-slate-900">Super Admin</strong> will review and accept your Event Manager profile.
                </>
              ) : (
                <>
                  Please wait for a few minutes. Your studio's <strong className="font-semibold text-slate-900">Event Manager</strong> will review and accept your request to join the team.
                </>
              )}
            </p>

            {state.email && (
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500">Account Email:</span>
                  <strong className="text-slate-900 font-semibold">{state.email}</strong>
                </div>
                {state.team_name && (
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Studio / Team:</span>
                    <strong className="text-slate-900 font-semibold">{state.team_name}</strong>
                  </div>
                )}
                <div className="flex justify-between py-1.5 pt-2">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-amber-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Waiting for Admin Approval
                  </span>
                </div>
              </div>
            )}

            <div className="mt-8">
              <Link to="/login" className="btn-primary inline-block w-full py-3.5 text-center text-sm font-bold">
                Go back to Sign In
              </Link>
              <p className="mt-4 text-xs text-slate-400">
                Once approved by the admin, you can sign in directly with your email and password.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ================= ROUTING =================

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth requestAccess />} />
      <Route path="/request-submitted" element={<RequestSubmittedPage />} />
      <Route path="/request-pending" element={<RequestSubmittedPage />} />
      <Route path="/super/dashboard" element={<SuperDashboard />} />
      <Route path="/manager/dashboard" element={<Dashboard manager />} />
      <Route path="/manager/requests" element={<ManagerRequests />} />
      <Route path="/manager/events/:id" element={<EventManager />} />
      <Route path="/team/dashboard" element={<Dashboard manager={false} />} />
      <Route path="/team/events/:id/upload" element={<Upload />} />
      <Route path="/gallery/:slug" element={<PublicGallery />} />
      <Route path="/admin/dashboard" element={<Navigate to="/manager/dashboard" replace />} />
      <Route path="/admin/events/:id" element={<Navigate to="/manager/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);