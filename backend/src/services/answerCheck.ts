import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, GeneratedQuestion, extractJson } from "./questionGenerator";

// A second, independent look at every multiple-choice question. The checker is NOT told which
// option was marked correct and sees the options in a shuffled order, so it can't just agree.
// A disagreement doesn't delete anything: the draft is flagged and the teacher decides.
export interface AiCheck { status: "agreed" | "disagreed" | "unclear"; note?: string }

const LETTERS = "ABCDEFGH";
const short = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s);

export function verifyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AI_VERIFY !== "false";
}

// orders[q][k] = index (in the original options) of the option shown k-th to the checker.
export function shuffledOrders(qs: GeneratedQuestion[], rand: () => number = Math.random): number[][] {
  return qs.map((q) => {
    const idx = q.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  });
}

export function buildVerifyPrompt(qs: GeneratedQuestion[], orders: number[][], ctx: { subjectName: string; className: string }): string {
  const body = qs
    .map((q, n) => `${n + 1}. ${q.questionText}\n${orders[n].map((oi, k) => `   ${LETTERS[k]}. ${q.options[oi].text}`).join("\n")}`)
    .join("\n\n");
  return `Subject: ${ctx.subjectName}\nClass: ${ctx.className}\n\nQuestions:\n${body}\n\n` +
    `For each question, decide which option is correct by working it out yourself (do any calculation step by step). ` +
    `Do not assume any option is right. Answer "none" if no option is correct, or "multiple" if more than one is correct.\n` +
    `Return JSON only: {"results":[{"id":1,"answer":"B","note":"<at most 20 words on why; never mention option letters>"}]}`;
}

export function interpretVerification(raw: any, qs: GeneratedQuestion[], orders: number[][]): (AiCheck | null)[] {
  const byId = new Map<number, any>();
  for (const r of Array.isArray(raw?.results) ? raw.results : []) byId.set(Number(r?.id), r);

  return qs.map((q, n) => {
    const r = byId.get(n + 1);
    const answer = typeof r?.answer === "string" ? r.answer.trim().toLowerCase() : "";
    const note = typeof r?.note === "string" ? r.note.trim().slice(0, 200) : "";
    if (!answer) return null;

    if (answer === "none") return { status: "unclear", note: "The second check found no clearly correct option." };
    if (answer === "multiple") return { status: "unclear", note: "The second check found more than one defensible answer." };

    const k = LETTERS.indexOf(answer.toUpperCase());
    if (answer.length !== 1 || k < 0 || k >= orders[n].length) return null;

    const chosen = orders[n][k];
    const marked = q.options.findIndex((o) => o.isCorrect);
    if (chosen === marked) return { status: "agreed" };
    return {
      status: "disagreed",
      note: `The second check chose “${short(q.options[chosen].text)}” instead of “${short(q.options[marked].text)}”.${note ? ` ${note}` : ""}`
    };
  });
}

// Never throws: if the check can't run, generation still succeeds and the drafts simply have no badge.
export async function verifyMcqs(
  questions: GeneratedQuestion[],
  ctx: { subjectName: string; className: string }
): Promise<{ checks: (AiCheck | null)[]; inputTokens: number; outputTokens: number }> {
  const checks: (AiCheck | null)[] = questions.map(() => null);
  const none = { checks, inputTokens: 0, outputTokens: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcqIdx = questions.map((q, i) => (q.type === "mcq" ? i : -1)).filter((i) => i >= 0);
  if (!verifyEnabled() || !apiKey || mcqIdx.length === 0) return none;

  const mcqs = mcqIdx.map((i) => questions[i]);
  const orders = shuffledOrders(mcqs);
  try {
    const client = new Anthropic({ apiKey, timeout: 40_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: "You are a careful examiner checking multiple-choice questions for a Nigerian school. Work each one out yourself and be precise. Respond with a single JSON object and nothing else.",
      messages: [{ role: "user", content: buildVerifyPrompt(mcqs, orders, ctx) }]
    });
    const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
    console.log(`AI answer check: model=${AI_MODEL} in=${usage.inputTokens} out=${usage.outputTokens}`);
    try {
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      interpretVerification(extractJson(text), mcqs, orders).forEach((c, n) => { checks[mcqIdx[n]] = c; });
    } catch (err: any) {
      console.error("AI answer check unreadable:", err?.message);
    }
    return { checks, ...usage };
  } catch (err: any) {
    console.error("AI answer check failed:", err?.message);
    return none;
  }
}
