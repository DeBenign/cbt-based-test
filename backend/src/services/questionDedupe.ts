// Spots questions that repeat something already in the bank (or earlier in the same batch).
// Pure functions: no database, easy to test.

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const tokens = (t: string) => normalise(t).split(" ").filter(Boolean);
const numbersIn = (toks: string[]) => toks.filter((t) => /^\d+$/.test(t)).sort().join(",");

// Same wording, or nearly the same words AND the same numbers. "What is 12 x 5?" and
// "What is 12 x 6?" are different questions, so a changed number is never a duplicate.
export function isNearDuplicate(a: string, b: string, threshold = 0.8): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  if (numbersIn(ta) !== numbersIn(tb)) return false;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let shared = 0;
  sa.forEach((t) => { if (sb.has(t)) shared++; });
  return shared / (sa.size + sb.size - shared) >= threshold;
}

export function filterDuplicates<T extends { questionText: string }>(
  candidates: T[],
  existing: string[]
): { kept: T[]; duplicates: T[] } {
  const kept: T[] = [];
  const duplicates: T[] = [];
  for (const c of candidates) {
    const clash = existing.some((e) => isNearDuplicate(c.questionText, e)) || kept.some((k) => isNearDuplicate(c.questionText, k.questionText));
    (clash ? duplicates : kept).push(c);
  }
  return { kept, duplicates };
}
