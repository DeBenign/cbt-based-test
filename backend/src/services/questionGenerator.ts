import Anthropic from "@anthropic-ai/sdk";

export interface GenerateParams {
  subjectName: string;
  className: string;
  topics: { title: string; text: string }[];
  mcqCount: number;
  theoryCount: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  theoryMarks: number;
}

export interface GeneratedQuestion {
  type: "mcq" | "theory";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  correctAnswerText?: string;
  marks: number;
}

export class AiNotConfiguredError extends Error {}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_CURRICULUM_CHARS = 30000;

const SYSTEM = `You are an experienced exam-setter for a Nigerian secondary school, writing questions in the style of WAEC, NECO and school terminal exams.
Rules:
- Base every question ONLY on the curriculum text provided. Do not use outside knowledge to add topics that are not in it.
- Multiple-choice questions have exactly 4 options and exactly one correct option. Wrong options must be plausible, not silly, and not "all of the above" / "none of the above".
- Theory questions need a concise marking guide in "correctAnswerText": the key points a teacher should award marks for.
- Questions must be clear, self-contained, unambiguous and appropriate for the class level.
- Do not repeat a question or test the same fact twice.
- Respond with a single JSON object and nothing else: no prose, no markdown fences.`;

function buildPrompt(p: GenerateParams): string {
  const per = Math.floor(MAX_CURRICULUM_CHARS / Math.max(1, p.topics.length));
  const material = p.topics
    .map((t) => `### ${t.title}\n${t.text.slice(0, per)}`)
    .join("\n\n");

  const difficultyLine =
    p.difficulty === "mixed" ? "Mix easy, medium and hard questions." : `All questions should be ${p.difficulty}.`;

  return `Subject: ${p.subjectName}
Class: ${p.className}

CURRICULUM TEXT:
${material}

Write ${p.mcqCount} multiple-choice question(s) and ${p.theoryCount} theory question(s). ${difficultyLine}
Each theory question is worth ${p.theoryMarks} marks; each multiple-choice question is worth 1 mark.
"topic" must be exactly one of these headings: ${p.topics.map((t) => `"${t.title}"`).join(", ")}.

Return JSON in exactly this shape:
{"questions":[
 {"type":"mcq","topic":"<heading>","difficulty":"easy|medium|hard","questionText":"...","options":[{"text":"...","isCorrect":false},{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}],"marks":1},
 {"type":"theory","topic":"<heading>","difficulty":"easy|medium|hard","questionText":"...","correctAnswerText":"<marking guide>","marks":${p.theoryMarks}}
]}`;
}

function extractJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI didn't return valid JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// The model's output is untrusted: every question is re-validated, and
// anything malformed is dropped rather than saved.
export function validateQuestions(raw: any, p: GenerateParams): { valid: GeneratedQuestion[]; rejected: number } {
  const topicTitles = new Set(p.topics.map((t) => t.title));
  const fallbackTopic = p.topics[0].title;
  const valid: GeneratedQuestion[] = [];
  let rejected = 0;
  const seen = new Set<string>();

  for (const q of Array.isArray(raw?.questions) ? raw.questions : []) {
    const text = typeof q?.questionText === "string" ? q.questionText.trim() : "";
    const key = text.toLowerCase();
    if (!text || seen.has(key)) { rejected++; continue; }

    const difficulty: GeneratedQuestion["difficulty"] = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium";
    const topic = topicTitles.has(q.topic) ? q.topic : fallbackTopic;

    if (q.type === "mcq") {
      const options = Array.isArray(q.options)
        ? q.options
            .map((o: any) => ({ text: typeof o?.text === "string" ? o.text.trim() : "", isCorrect: o?.isCorrect === true }))
            .filter((o: any) => o.text)
        : [];
      const distinct = new Set(options.map((o: any) => o.text.toLowerCase()));
      if (options.length < 3 || options.length > 6 || distinct.size !== options.length || options.filter((o: any) => o.isCorrect).length !== 1) {
        rejected++;
        continue;
      }
      seen.add(key);
      valid.push({ type: "mcq", topic, difficulty, questionText: text, options, marks: 1 });
    } else if (q.type === "theory") {
      const guide = typeof q.correctAnswerText === "string" ? q.correctAnswerText.trim() : "";
      if (!guide) { rejected++; continue; }
      seen.add(key);
      valid.push({ type: "theory", topic, difficulty, questionText: text, options: [], correctAnswerText: guide, marks: p.theoryMarks });
    } else {
      rejected++;
    }
  }

  // Never return more than was asked for, per type.
  const mcq = valid.filter((q) => q.type === "mcq").slice(0, p.mcqCount);
  const theory = valid.filter((q) => q.type === "theory").slice(0, p.theoryCount);
  return { valid: [...mcq, ...theory], rejected: rejected + (valid.length - mcq.length - theory.length) };
}

export async function generateQuestions(p: GenerateParams) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey, timeout: 50_000, maxRetries: 1 });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(p) }]
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  return validateQuestions(extractJson(text), p);
}
