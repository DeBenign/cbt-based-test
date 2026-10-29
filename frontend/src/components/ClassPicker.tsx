import { ClassRoom } from "../types";
import { groupByLevel } from "../utils/levels";

interface Props {
  classes: ClassRoom[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Checkboxes for classes, grouped by Nursery / Primary / Secondary,
// with an "all / none" shortcut per group so one subject can be linked to a whole section at once.
export default function ClassPicker({ classes, selected, onChange }: Props) {
  if (classes.length === 0) return null;

  function setGroup(ids: string[], on: boolean) {
    const rest = selected.filter((id) => !ids.includes(id));
    onChange(on ? [...rest, ...ids] : rest);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {groupByLevel(classes).map((g) => {
        const ids = g.items.map((c) => c._id);
        const allOn = ids.every((id) => selected.includes(id));
        return (
          <div key={g.level}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              <b>{g.label}</b>{" "}
              <button type="button" onClick={() => setGroup(ids, !allOn)} style={{ padding: "1px 8px", fontSize: 11, marginLeft: 6 }}>
                {allOn ? "Clear" : "Select all"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {g.items.map((c) => (
                <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c._id)}
                    onChange={() => onChange(selected.includes(c._id) ? selected.filter((x) => x !== c._id) : [...selected, c._id])}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
