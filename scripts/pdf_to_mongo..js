#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeSlug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const fingerprint = (text, type = "mcq") =>
  crypto
    .createHash("sha1")
    .update(`${normalizeText(type).toLowerCase()}::${normalizeText(text).toLowerCase()}`)
    .digest("hex");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    input: "",
    output: path.join(process.cwd(), "output.import.json"),
    examSlug: "sbi-clerk",
    stageSlug: "prelims",
    domain: "Government Exam - SBI Clerk",
    topic: "",
    sourceExam: "SBI Clerk",
    sourceYear: new Date().getFullYear(),
    sourceShift: 1,
    sourceType: "memory-based",
    testId: "gov-sbi-clerk-prelims-speed-test-daily-45m",
    testTitle: "SBI Clerk Prelims - Speed Test",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--input" && args[i + 1]) out.input = args[i + 1];
    if (arg === "--output" && args[i + 1]) out.output = args[i + 1];
    if (arg === "--examSlug" && args[i + 1]) out.examSlug = args[i + 1];
    if (arg === "--stageSlug" && args[i + 1]) out.stageSlug = args[i + 1];
    if (arg === "--domain" && args[i + 1]) out.domain = args[i + 1];
    if (arg === "--topic" && args[i + 1]) out.topic = args[i + 1];
    if (arg === "--sourceExam" && args[i + 1]) out.sourceExam = args[i + 1];
    if (arg === "--sourceYear" && args[i + 1]) out.sourceYear = Number(args[i + 1]) || out.sourceYear;
    if (arg === "--sourceShift" && args[i + 1]) out.sourceShift = Number(args[i + 1]) || out.sourceShift;
    if (arg === "--sourceType" && args[i + 1]) out.sourceType = args[i + 1];
    if (arg === "--testId" && args[i + 1]) out.testId = args[i + 1];
    if (arg === "--testTitle" && args[i + 1]) out.testTitle = args[i + 1];
  }

  if (!out.input) {
    throw new Error("Missing --input <pdf-path>");
  }

  return out;
};

const extractQuestionNumber = (line, fallback) => {
  const match = String(line || "").match(/^\s*(?:q(?:ue)?\.?\s*)?(\d{1,4})[\)\].:\-\s]+/i);
  if (!match) return fallback;
  return Number(match[1]) || fallback;
};

const stripQuestionNumber = (line) =>
  String(line || "")
    .replace(/^\s*(?:qu(?:e|estion)?\.?\s*)?\d{1,4}[\)\].:\-\s]+/i, "")
    .trim();

const parseAnswerKey = (line) => {
  const keyMatch = String(line || "").match(/\b([A-Ea-e]|[1-5])\b/);
  if (!keyMatch) return "";
  const raw = keyMatch[1].toUpperCase();
  if (/^[1-5]$/.test(raw)) {
    return String.fromCharCode(64 + Number(raw));
  }
  return raw;
};

const parseTextToQuestions = (rawText, defaults) => {
  const text = String(rawText || "").replace(/\r/g, "\n");
  const blocks = text
    .split(/\n(?=\s*(?:qu(?:e|estion)?\.?\s*)?\d{1,4}[\)\].:\-\s]+)/gi)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];

  blocks.forEach((block, idx) => {
    const lines = block
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean);
    if (lines.length === 0) return;

    const isOptionLine = (line) => /^\s*([A-Ea-e]|[1-5])[\)\].:\-\s]+/.test(line);
    const isAnswerLine = (line) => /^(answer|correct option)\s*[:\-]/i.test(line);
    const isExplanationLine = (line) => /^explanation\s*[:\-]/i.test(line);

    const questionNumber = extractQuestionNumber(lines[0], idx + 1);
    let question = stripQuestionNumber(lines[0]);
    let cursorStart = 1;
    // Handle number-only lead line (e.g. "5.") where question is on the next line.
    if (!question && lines.length > 1) {
      for (let i = 1; i < lines.length; i += 1) {
        const candidate = lines[i];
        if (isOptionLine(candidate) || isAnswerLine(candidate) || isExplanationLine(candidate)) break;
        question = stripQuestionNumber(candidate);
        cursorStart = i + 1;
        if (question) break;
      }
    }
    if (!question) return;

    const options = [];
    let answerKey = "";
    let explanation = "";
    let lastOptionIndex = -1;

    for (let i = cursorStart; i < lines.length; i += 1) {
      const line = lines[i];
      if (isOptionLine(line)) {
        const labelMatch = line.match(/^\s*([A-Ea-e]|[1-5])/);
        const rawId = labelMatch ? labelMatch[1].toUpperCase() : "";
        const id = /^[1-5]$/.test(rawId) ? String.fromCharCode(64 + Number(rawId)) : rawId || String.fromCharCode(65 + options.length);
        const textValue = line.replace(/^\s*([A-Ea-e]|[1-5])[\)\].:\-\s]+/, "").trim();
        if (textValue) {
          options.push({ id, text: textValue });
          lastOptionIndex = options.length - 1;
        }
        continue;
      }
      if (isAnswerLine(line)) {
        answerKey = parseAnswerKey(line);
        continue;
      }
      if (isExplanationLine(line)) {
        explanation = line.replace(/^explanation\s*[:\-]\s*/i, "").trim();
        continue;
      }

      if (!line) continue;

      if (options.length === 0) {
        // Question stem continuation before first option.
        question = normalizeText(`${question} ${line}`);
        continue;
      }

      if (lastOptionIndex >= 0) {
        // Option continuation line in wrapped PDF text.
        options[lastOptionIndex].text = normalizeText(`${options[lastOptionIndex].text} ${line}`);
      }
    }

    if (options.length < 2) return;
    const answerText = options.find((opt) => opt.id === answerKey)?.text || "";

    questions.push({
      questionNumber,
      source: {
        exam: defaults.sourceExam,
        year: defaults.sourceYear,
        shift: defaults.sourceShift,
        type: defaults.sourceType,
      },
      question,
      options: options.slice(0, 5),
      answerKey,
      answer: answerText,
      explanation,
      difficulty: "medium",
      type: "mcq",
      topic: defaults.topic || "",
      section: "",
      examSlug: defaults.examSlug,
      stageSlug: defaults.stageSlug,
      domain: defaults.domain,
      testId: defaults.testId,
      testTitle: defaults.testTitle,
      promptContext: "Imported from PDF parser script",
      fingerprint: fingerprint(question, "mcq"),
    });
  });

  return questions;
};

const readPdfText = async (pdfPath) => {
  const repoRoot = path.join(__dirname, "..", "..");
  const pdfjsPath = path.join(repoRoot, "guru-ui", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
  if (!fs.existsSync(pdfjsPath)) {
    throw new Error(`pdfjs not found at ${pdfjsPath}. Run npm install in guru-ui first.`);
  }

  const moduleUrl = pathToFileURL(pdfjsPath).href;
  const pdfjsModule = await import(moduleUrl);
  const pdfjs = pdfjsModule.default || pdfjsModule;
  if (typeof pdfjs.getDocument !== "function") {
    throw new Error("pdfjs getDocument not available");
  }

  const absPdfPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(process.cwd(), pdfPath);
  if (!fs.existsSync(absPdfPath)) {
    throw new Error(`PDF file not found: ${absPdfPath}`);
  }

  const bytes = new Uint8Array(fs.readFileSync(absPdfPath));
  const task = pdfjs.getDocument({ data: bytes, disableWorker: true });
  const pdf = await task.promise;
  const chunks = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = Array.isArray(content?.items)
      ? content.items
          .map((item) => {
            if (!item || typeof item !== "object" || !("str" in item)) return "";
            return `${String(item.str || "")}${item.hasEOL ? "\n" : " "}`;
          })
          .join("")
      : "";
    chunks.push(text);
  }

  return chunks.join("\n");
};

const run = async () => {
  const args = parseArgs();
  const text = await readPdfText(args.input);
  const questions = parseTextToQuestions(text, args);

  const payload = {
    examSlug: normalizeSlug(args.examSlug),
    stageSlug: normalizeSlug(args.stageSlug),
    domain: normalizeText(args.domain),
    provider: "pdf-import",
    testId: normalizeText(args.testId),
    testTitle: normalizeText(args.testTitle),
    promptContext: "Imported from pdf_to_mongo script",
    questions,
  };

  fs.writeFileSync(args.output, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Converted ${questions.length} questions`);
  console.log(`Output: ${path.resolve(args.output)}`);
};

run().catch((error) => {
  console.error("PDF conversion failed:", error?.message || error);
  process.exit(1);
});
