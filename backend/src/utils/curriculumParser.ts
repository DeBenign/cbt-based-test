import mammoth from "mammoth";
import { ICurriculumTopic } from "../models/Curriculum";


export type SourceType = "pdf" | "docx" | "text";

export function detectSourceType(fileName: string, mimeType: string): SourceType | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || mimeType.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".txt") || name.endsWith(".md") || mimeType.startsWith("text/")) return "text";
  return null;
}

export async function extractText(buffer: Buffer, type: SourceType): Promise<string> {
     if (type === "pdf") {
     // eslint-disable-next-line @typescript-eslint/no-var-requires
     const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
     const parser = new PDFParse({ data: new Uint8Array(buffer) });
     try {
       return (await parser.getText()).text;
     } finally {
       await parser.destroy();
     }
   }
  if (type === "docx") return (await mammoth.extractRawText({ buffer })).value;
  return buffer.toString("utf8");
}

const MAX_SECTION_CHARS = 9000; // keeps one section comfortably inside a single AI request
const MIN_SECTION_CHARS = 200;
const MAX_TOPICS = 200;

const HEADING_WORDS = /^(week|unit|chapter|topic|module|theme|term|section|lesson|strand)\b/i;
const NUMBERED = /^\d+(\.\d+)*[).:]?\s+\S/;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (HEADING_WORDS.test(t)) return true;
  if (NUMBERED.test(t) && !/[.,;]$/.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function clean(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Splits long text into pieces no larger than `max`, preferring paragraph breaks.
function chunkBySize(text: string, max: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if ((current + "\n\n" + para).length > max && current) {
      out.push(current);
      current = "";
    }
    if (para.length > max) {
      for (let i = 0; i < para.length; i += max) out.push(para.slice(i, i + max));
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) out.push(current);
  return out;
}

// Heading-aware split: "Week 3: Photosynthesis" style lines start a new
// topic. If the document has no recognisable headings it falls back to
// even-sized "Part N" sections so it is still usable.
export function splitIntoTopics(rawText: string): ICurriculumTopic[] {
  const text = clean(rawText);
  if (!text) return [];

  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of text.split("\n")) {
    if (looksLikeHeading(line)) {
      current = { title: line.trim().replace(/[:\-–—\s]+$/, ""), body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      current = { title: "Introduction", body: [line] };
      sections.push(current);
    }
  }

  // Merge sections that are only a heading or a couple of lines into the previous one.
  const merged: { title: string; body: string }[] = [];
  for (const s of sections) {
    const body = s.body.join("\n").trim();
    if (merged.length > 0 && body.length < MIN_SECTION_CHARS) {
      const prev = merged[merged.length - 1];
      prev.body = `${prev.body}\n\n${s.title}\n${body}`.trim();
    } else {
      merged.push({ title: s.title, body });
    }
  }

  const headingsUsable = merged.length >= 1 && (merged.length >= 2 || merged[0].title !== "Introduction");
  const topics: ICurriculumTopic[] = [];

  if (headingsUsable) {
    for (const s of merged) {
      const pieces = chunkBySize(s.body || s.title, MAX_SECTION_CHARS);
      pieces.forEach((piece, i) =>
        topics.push({ title: pieces.length > 1 ? `${s.title} (part ${i + 1})` : s.title, text: piece })
      );
    }
  } else {
    chunkBySize(text, MAX_SECTION_CHARS).forEach((piece, i) => topics.push({ title: `Part ${i + 1}`, text: piece }));
  }

  return topics.slice(0, MAX_TOPICS);
}
