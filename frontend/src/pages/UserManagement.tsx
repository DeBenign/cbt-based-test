import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { AppUser, Subject, ClassRoom } from "../types";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";
import BulkUpload from "../components/BulkUpload";
import { useRolePath } from "../hooks/useRolePath";
import { useConfirm } from "../context/ConfirmContext";

const roleTone: Record<string, "accent" | "warning" | "success"> = {
  admin: "accent",
  teacher: "warning",
  student: "success"
};

function idSuffix(id?: string) {
  return id ? id.slice(-6) : "—";
}

function CheckList({ items, selected, onChange }: { items: { _id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => (
        <label key={it._id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, padding: "4px 10px", border: "0.5px solid var(--border)", borderRadius: 14, background: selected.includes(it._id) ? "var(--accent-soft, #eef1ff)" : "transparent", cursor: "pointer" }}>
          <input type="checkbox" checked={selected.includes(it._id)} onChange={() => toggle(it._id)} style={{ width: "auto", margin: 0 }} />
          {it.name}
        </label>
      ))}
    </div>
  );
}

export default function UserManagement() {
  const rolePath = useRolePath();
  const confirm = useConfirm();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [assignDrafts, setAssignDrafts] = useState<Record<string, { subjectIds: string[]; classIds: string[] }>>({});
  const [assignMessages, setAssignMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetDrafts, setResetDrafts] = useState<Record<string, string>>({});
  const [resetMessages, setResetMessages] = useState<Record<string, string>>({});

  async function loadAll() {
    const [classRes, subRes] = await Promise.all([api.get("/classes"), api.get("/subjects")]);
    setClasses(classRes.data);
    setSubjects(subRes.data);
    if (classRes.data.length > 0 && !classId) setClassId(classRes.data[0]._id);
    if (subRes.data.length > 0 && !subjectId) setSubjectId(subRes.data[0]._id);
  }

  async function loadUsers() {
    const res = await api.get("/users", {
      params: {
        page,
        limit: 25,
        q: search || undefined,
        role: filterRole || undefined,
        classId: filterClass || undefined
      }
    });
    setUsers(res.data.items);
    setPages(res.data.pages);
    setTotal(res.data.total);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterRole, filterClass]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (role === "student" && !classId) {
      setError("Select a class before creating a student account.");
      return;
    }

    try {
      await api.post("/auth/register", {
        name,
        email,
        password,
        role,
        classId: role === "student" ? classId : undefined,
        subjectIds: role === "teacher" ? teacherSubjects : undefined,
        classIds: role === "teacher" ? teacherClasses : undefined
      });
      setSuccess(`${role === "teacher" ? "Teacher" : "Student"} account created for ${email}.`);
      setName("");
      setEmail("");
      setPassword("");
      setTeacherSubjects([]);
      setTeacherClasses([]);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't create the account.");
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm("Delete this account? They'll lose access immediately. This can't be undone.");
    if (!ok) return;
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't delete the account.");
    }
  }

  async function handleSaveAssignments(id: string, draft: { subjectIds: string[]; classIds: string[] }) {
    try {
      const res = await api.put(`/users/${id}/assignments`, draft);
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, subjectIds: res.data.subjectIds, classIds: res.data.classIds } : u)));
      setAssignDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setAssignMessages((prev) => ({ ...prev, [id]: "Saved. It applies the next time they open the app." }));
    } catch (err: any) {
      setAssignMessages((prev) => ({ ...prev, [id]: err.response?.data?.error || "Couldn't save." }));
    }
  }

  async function handleResetPassword(id: string) {
    const newPassword = resetDrafts[id];
    if (!newPassword || newPassword.length < 4) {
      setResetMessages((prev) => ({ ...prev, [id]: "Enter at least 4 characters." }));
      return;
    }
    try {
      const res = await api.post(`/users/${id}/reset-password`, { newPassword });
      setResetMessages((prev) => ({ ...prev, [id]: res.data.message }));
      setResetDrafts((prev) => ({ ...prev, [id]: "" }));
    } catch (err: any) {
      setResetMessages((prev) => ({ ...prev, [id]: err.response?.data?.error || "Couldn't reset the password." }));
    }
  }

  const missingSetup = classes.length === 0 || subjects.length === 0;
  const classById = Object.fromEntries(classes.map((c) => [c._id, c]));
  const subjectById = Object.fromEntries(subjects.map((s) => [s._id, s]));

  const duplicateClassNames = new Set(
    Object.entries(
      classes.reduce<Record<string, number>>((acc, c) => {
        acc[c.name] = (acc[c.name] || 0) + 1;
        return acc;
      }, {})
    )
      .filter(([, count]) => count > 1)
      .map(([n]) => n)
  );

  return (
    <PageShell maxWidth={760}>
      <h1>Manage users</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Create login accounts for teachers and students — one at a time, or a whole class or school from a spreadsheet.
        There's no public sign-up, so this is the only way anyone gets access.
      </p>

      {duplicateClassNames.size > 0 && (
        <Card style={{ marginBottom: 20, borderColor: "var(--text-danger)" }}>
          <p style={{ color: "var(--text-danger)", marginBottom: 0, fontSize: 13 }}>
            You have more than one class named "{Array.from(duplicateClassNames).join(", ")}" with different
            IDs. Students and exams pick a specific class by ID, not by name — if a student's class and an
            exam's class are actually different entries that just look the same, the student won't see it.
            Check the ID suffixes below and in Setup, and remove the duplicate if it's not needed.
          </p>
        </Card>
      )}

      {missingSetup && (
        <Card style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 12 }}>
            Add at least one class and one subject in Setup before creating student or teacher accounts.
          </p>
          <Link to={rolePath("/setup")}>
            <PrimaryButton type="button">Go to Setup</PrimaryButton>
          </Link>
        </Card>
      )}

      {!missingSetup && <BulkUpload classes={classes} onDone={loadUsers} />}

      {!missingSetup && (
        <Card style={{ marginBottom: 24 }}>
          <h3>Add a single user</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div style={{ width: 140 }}>
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "teacher" | "student")} style={{ width: "100%" }}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Temporary password</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ padding: "0 10px", fontSize: 12 }}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
            {role === "student" && (
              <div style={{ marginBottom: 10 }}>
                <label>Class</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} required style={{ width: "100%" }}>
                  <option value="">-- Select a class --</option>
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} (id:{idSuffix(c._id)})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {role === "teacher" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label>Subjects they teach</label>
                  <CheckList items={subjects} selected={teacherSubjects} onChange={setTeacherSubjects} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label>Classes they teach</label>
                  <CheckList items={classes} selected={teacherClasses} onChange={setTeacherClasses} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
                    A teacher can only see and change questions, exams, results and analytics for the subjects and classes ticked here.
                  </p>
                </div>
              </>
            )}
            {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}
            {success && <p style={{ color: "var(--text-success)", fontSize: 13 }}>{success}</p>}
            <PrimaryButton type="submit">Create account</PrimaryButton>
          </form>
        </Card>
      )}

      <h3>Existing users ({total})</h3>
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}
      >
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search name, username or email"
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={filterRole} onChange={(e) => { setPage(1); setFilterRole(e.target.value); }}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
        </select>
        <select value={filterClass} onChange={(e) => { setPage(1); setFilterClass(e.target.value); }}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button type="submit">Search</button>
      </form>
      {users.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No users match.</p>}
      {users.map((u) => {
        const cls = u.classId ? classById[u.classId] : undefined;
        const teacherSubjectNames = (u.subjectIds || []).map((id) => subjectById[id]?.name).filter(Boolean);
        const teacherClassNames = (u.classIds || []).map((id) => classById[id]?.name).filter(Boolean);
        const isExpanded = expandedId === u._id;
        return (
          <Card key={u._id} style={{ marginBottom: 8 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setExpandedId(isExpanded ? null : u._id)}
            >
              <div>
                <p style={{ fontWeight: 500, marginBottom: 2 }}>{u.name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
                  {u.email.endsWith("@users.benchmark.local") ? `Username: ${u.username}` : `${u.email}${u.username ? ` · username: ${u.username}` : ""}`}
                </p>
                {u.role === "student" && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 0 }}>
                    Class: {cls ? `${cls.name} (id:${idSuffix(cls._id)})` : "none assigned"}
                  </p>
                )}
                {u.role === "teacher" && (
                  <>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                      Subjects: {teacherSubjectNames.length ? teacherSubjectNames.join(", ") : "none"}
                    </p>
                    <p style={{ fontSize: 12, color: teacherClassNames.length ? "var(--text-muted)" : "var(--text-danger)", marginBottom: 0 }}>
                      Classes: {teacherClassNames.length ? teacherClassNames.join(", ") : "none assigned — they can't work in any class yet"}
                    </p>
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge tone={roleTone[u.role]}>{u.role}</Badge>
                {u.role !== "admin" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(u._id);
                    }}
                    style={{ padding: "3px 10px", fontSize: 12 }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
                <p>User ID: {u._id}</p>
                <p>Created: {new Date(u.createdAt).toLocaleString()}</p>

                {u.role === "teacher" && (() => {
                  const draft = assignDrafts[u._id] || { subjectIds: u.subjectIds || [], classIds: u.classIds || [] };
                  return (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                      <p style={{ fontWeight: 500, marginBottom: 6 }}>Subjects and classes</p>
                      <CheckList items={subjects} selected={draft.subjectIds} onChange={(ids) => setAssignDrafts((p) => ({ ...p, [u._id]: { ...draft, subjectIds: ids } }))} />
                      <div style={{ height: 8 }} />
                      <CheckList items={classes} selected={draft.classIds} onChange={(ids) => setAssignDrafts((p) => ({ ...p, [u._id]: { ...draft, classIds: ids } }))} />
                      <button type="button" onClick={() => handleSaveAssignments(u._id, draft)} style={{ marginTop: 10, padding: "3px 10px", fontSize: 12 }}>Save</button>
                      {assignMessages[u._id] && <p style={{ marginTop: 6, marginBottom: 0 }}>{assignMessages[u._id]}</p>}
                    </div>
                  );
                })()}

                {u.role !== "admin" && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)" }}>
                    <p style={{ fontWeight: 500, marginBottom: 6 }}>Reset password</p>
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="New temporary password"
                        value={resetDrafts[u._id] || ""}
                        onChange={(e) => setResetDrafts((prev) => ({ ...prev, [u._id]: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                      <button type="button" onClick={() => handleResetPassword(u._id)} style={{ padding: "3px 10px", fontSize: 12 }}>
                        Reset
                      </button>
                    </div>
                    {resetMessages[u._id] && (
                      <p style={{ marginTop: 6, marginBottom: 0 }}>{resetMessages[u._id]}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </PageShell>
  );
}