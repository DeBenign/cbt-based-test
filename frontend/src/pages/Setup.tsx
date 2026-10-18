import { useEffect, useState, FormEvent } from "react";
import api from "../services/api";
import { Subject, ClassRoom } from "../types";
import Card from "../components/Card";
import PrimaryButton from "../components/PrimaryButton";
import PageShell from "../components/PageShell";

function idSuffix(id: string) {
  return id.slice(-6);
}

function findDuplicateNames(items: { name: string }[]): Set<string> {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.name] = (counts[i.name] || 0) + 1;
  return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n));
}

export default function Setup() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);

  const [subjectName, setSubjectName] = useState("");
  const [subjectClassIds, setSubjectClassIds] = useState<string[]>([]);
  const [className, setClassName] = useState("");
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [error, setError] = useState<string | null>(null);

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editClassIds, setEditClassIds] = useState<string[]>([]);

  async function loadAll() {
    const [subRes, classRes] = await Promise.all([api.get("/subjects"), api.get("/classes")]);
    setSubjects(subRes.data);
    setClasses(classRes.data);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/subjects", { name: subjectName, classIds: subjectClassIds });
      setSubjectName("");
      setSubjectClassIds([]);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't add the subject.");
    }
  }

  async function handleAddClass(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/classes", { name: className, academicYear });
      setClassName("");
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't add the class.");
    }
  }

  async function handleDeleteClass(id: string) {
    setError(null);
    try {
      await api.delete(`/classes/${id}`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't delete the class.");
    }
  }

  async function handleDeleteSubject(id: string) {
    setError(null);
    try {
      await api.delete(`/subjects/${id}`);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't delete the subject.");
    }
  }

  function startEditingClasses(subject: Subject) {
    setEditingSubjectId(subject._id);
    setEditClassIds(subject.classIds);
  }

  async function handleSaveSubjectClasses(id: string) {
    setError(null);
    try {
      await api.put(`/subjects/${id}`, { classIds: editClassIds });
      setEditingSubjectId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't update the subject's classes.");
    }
  }

  const duplicateClassNames = findDuplicateNames(classes);
  const duplicateSubjectNames = findDuplicateNames(subjects);

  return (
    <PageShell maxWidth={640}>
      <h1>Setup</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Create your classes and subjects here first — question banks, exams, and student accounts
        all pick from these instead of needing a raw ID. Each one shown below includes its ID suffix,
        so two entries with the same name (e.g. two "JSS2"s) are still tellable apart.
      </p>

      {error && <p style={{ color: "var(--text-danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <Card style={{ marginBottom: 20 }}>
        <h3>Classes</h3>
        <form onSubmit={handleAddClass} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            placeholder="e.g. JSS1"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <input
            placeholder="Academic year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            required
            style={{ width: 140 }}
          />
          <PrimaryButton type="submit">Add</PrimaryButton>
        </form>
        {classes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No classes yet.</p>}
        {classes.map((c) => (
          <div
            key={c._id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
              padding: "6px 0",
              borderBottom: "0.5px solid var(--border)"
            }}
          >
            <span style={{ color: duplicateClassNames.has(c.name) ? "var(--text-danger)" : "inherit" }}>
              {c.name} <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>· {c.academicYear} · id:{idSuffix(c._id)}</span>
            </span>
            <button type="button" onClick={() => handleDeleteClass(c._id)} style={{ padding: "3px 10px", fontSize: 12 }}>
              Delete
            </button>
          </div>
        ))}
      </Card>

      <Card>
        <h3>Subjects</h3>
        <form onSubmit={handleAddSubject} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <input
              placeholder="e.g. Basic Science"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <PrimaryButton type="submit">Add</PrimaryButton>
          </div>
          {classes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {classes.map((c) => (
                <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={subjectClassIds.includes(c._id)}
                    onChange={() => setSubjectClassIds((prev) => toggle(prev, c._id))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </form>

        {subjects.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No subjects yet.</p>}
        {subjects.map((s) => (
          <div key={s._id} style={{ padding: "6px 0", borderBottom: "0.5px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <span style={{ color: duplicateSubjectNames.has(s.name) ? "var(--text-danger)" : "inherit" }}>
                {s.name} <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>· id:{idSuffix(s._id)}</span>
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => startEditingClasses(s)} style={{ padding: "3px 10px", fontSize: 12 }}>
                  Edit classes
                </button>
                <button type="button" onClick={() => handleDeleteSubject(s._id)} style={{ padding: "3px 10px", fontSize: 12 }}>
                  Delete
                </button>
              </div>
            </div>

            {editingSubjectId === s._id && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                {classes.map((c) => (
                  <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={editClassIds.includes(c._id)}
                      onChange={() => setEditClassIds((prev) => toggle(prev, c._id))}
                    />
                    {c.name}
                  </label>
                ))}
                <button type="button" onClick={() => handleSaveSubjectClasses(s._id)} style={{ padding: "3px 10px", fontSize: 12 }}>
                  Save
                </button>
                <button type="button" onClick={() => setEditingSubjectId(null)} style={{ padding: "3px 10px", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </PageShell>
  );
}