import argparse
import hashlib
import json
import os
import re
from pathlib import Path

import pdfplumber
from tqdm import tqdm


QUESTION_LINE_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*)?(\d{1,4})[\.\)]\s*(.*)$", re.IGNORECASE)
OPTION_LINE_RE = re.compile(r"^\s*(?:\(?([A-E])\)|([A-E])[\.\)])\s+(.*)$", re.IGNORECASE)
INLINE_OPTION_SPLIT_RE = re.compile(r"(\(?[A-E]\)|[A-E][\.\)])\s*", re.IGNORECASE)
QUESTION_BLOCK_SPLIT_RE = re.compile(r"(?im)(?=^\s*(?:Q(?:uestion)?\s*)?\d{1,4}[\.\)]\s*)")
QUESTION_BLOCK_RE = re.compile(
    r"(?is)(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d{1,4})[\.\)]\s*(.+?)"
    r"(?=(?:^|\n)\s*(?:Q(?:uestion)?\s*)?\d{1,4}[\.\)]\s*|\Z)"
)
OPTION_MARKER_RE = re.compile(r"(?is)(?:^|\n|\s)(?:\(?([A-E])\)|([A-E])[\.\)])\s+")
REGEX_BLOCK_RE = re.compile(
    r"(?is)(?:^|\n)\s*(?:Q\s*)?(\d{1,4})[\.\)]\s*(.*?)\s*"
    r"(?:\(?A\)|A[\.\)])\s*(.*?)\s*"
    r"(?:\(?B\)|B[\.\)])\s*(.*?)\s*"
    r"(?:\(?C\)|C[\.\)])\s*(.*?)\s*"
    r"(?:\(?D\)|D[\.\)])\s*(.*?)"
    r"(?=\n\s*(?:Q\s*)?\d{1,4}[\.\)]\s*|\Z)"
)
YEAR_RE = re.compile(r"(20\d{2})")
SHIFT_RE = re.compile(r"(?:shift|s)[\s\-_]?(\d{1,2})", re.IGNORECASE)
NOISE_LINE_RE = re.compile(
    r"^\s*(?:page\s*\d+|memory\s*based|copyright|testbook|careerpower|adda247|oliveboard|practice\s*set)\b",
    re.IGNORECASE,
)


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value):
    return normalize_text(value).lower().replace(" ", "-")


def make_fingerprint(question, options, qtype="mcq"):
    normalized = f"{slugify(qtype)}::{normalize_text(question).lower()}::{'||'.join(normalize_text(opt).lower() for opt in options)}"
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def infer_source_from_filename(file_name):
    base = Path(file_name).stem
    year_match = YEAR_RE.search(base)
    shift_match = SHIFT_RE.search(base)
    return {
        "exam": normalize_text(base),
        "year": int(year_match.group(1)) if year_match else None,
        "shift": int(shift_match.group(1)) if shift_match else None,
        "type": "memory-based",
    }


def infer_section(text):
    source = normalize_text(text).lower()
    if re.search(r"\b(english|grammar|vocabulary|comprehension|cloze|error)\b", source):
        return "english-language"
    if re.search(r"\b(reasoning|puzzle|seating|syllogism|analogy|series)\b", source):
        return "reasoning-ability"
    if re.search(r"\b(math|quant|numerical|simplification|ratio|percentage|profit|loss|di)\b", source):
        return "numerical-ability"
    if re.search(r"\b(gk|general awareness|current affairs|history|geography|polity|economy|science)\b", source):
        return "general-awareness"
    return "mixed"


def is_valid_question_stem(question_text):
    text = normalize_text(question_text)
    if not text:
        return False

    # Too short stems are usually broken fragments after PDF wrapping.
    if len(text.split()) < 6:
        return False

    # Common truncated pattern seen in parsed output:
    # "... ? consonant?" or "... ? then?"
    if re.search(r"\?\s+[a-zA-Z]{1,12}\?$", text):
        return False

    # Trailing punctuation markers often indicate incomplete extraction.
    if text.endswith((':', '-', '(', ')')):
        return False

    return True


def clean_pdf_text(raw):
    text = str(raw or "")
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Keep parser robust: only normalize newlines around clear option markers.
    text = re.sub(r"(?<!\n)(\(?[A-E]\)|[A-E][\.\)])\s+", r"\n\1 ", text, flags=re.IGNORECASE)
    return text


def split_inline_options(line):
    parts = INLINE_OPTION_SPLIT_RE.split(line)
    if len(parts) < 3:
        return []

    out = []
    i = 1
    while i < len(parts) - 1:
        marker = normalize_text(parts[i])
        content = normalize_text(parts[i + 1])
        if marker and content:
            out.append(content)
        i += 2
    return out


def parse_question_block(question_number, lines, source_meta):
    option_entries = []
    stem_lines = []
    active_option_index = -1

    for raw_line in lines:
        line = normalize_text(raw_line)
        if not line:
            continue
        match = OPTION_LINE_RE.match(line)
        if match:
            marker = normalize_text(match.group(1) or match.group(2)).strip()
            option_text = normalize_text(match.group(3))
            if marker and option_text:
                option_entries.append(
                    {
                        "marker": marker,
                        "text": option_text,
                        "is_lower": marker.islower(),
                    }
                )
                active_option_index = len(option_entries) - 1
            continue

        inline_options = split_inline_options(line)
        if inline_options:
            for option_text in inline_options:
                option_entries.append(
                    {
                        "marker": "",
                        "text": normalize_text(option_text),
                        "is_lower": True,
                    }
                )
            active_option_index = len(option_entries) - 1
            continue

        if active_option_index >= 0:
            option_entries[active_option_index]["text"] = normalize_text(
                f"{option_entries[active_option_index]['text']} {line}"
            )
        else:
            stem_lines.append(line)

    question_text = normalize_text(" ".join(stem_lines))
    lower_options = [normalize_text(item["text"]) for item in option_entries if item.get("is_lower")]
    upper_options = [normalize_text(item["text"]) for item in option_entries if not item.get("is_lower")]
    options = lower_options if len(lower_options) >= 4 else upper_options

    if not question_text or len(options) < 4:
        return None

    if not is_valid_question_stem(question_text):
        return None

    options = options[:5]
    section = infer_section(f"{question_text} {' '.join(options)}")
    fingerprint = make_fingerprint(question_text, options, "mcq")

    return {
        "fingerprint": fingerprint,
        "questionNumber": question_number,
        "type": "mcq",
        "difficulty": "medium",
        "section": section,
        "topic": section,
        "source": source_meta,
        "question": question_text,
        "options": options,
        "answer": "",
        "answerKey": "",
        "explanation": "",
    }


def remove_noise_lines(text):
    kept = []
    for raw in str(text or "").splitlines():
        line = normalize_text(raw)
        if not line:
            continue
        if NOISE_LINE_RE.match(line):
            continue
        kept.append(line)
    return "\n".join(kept)


def extract_options_from_block(block_text):
    text = normalize_text(block_text)
    if not text:
        return "", []

    marker_matches = list(OPTION_MARKER_RE.finditer(text))
    if len(marker_matches) < 4:
        return text, []

    letters = []
    for match in marker_matches:
        letters.append(normalize_text(match.group(1) or match.group(2)).upper())

    first_a_index = -1
    for i, letter in enumerate(letters):
        if letter == "A":
            first_a_index = i
            break

    if first_a_index < 0:
        return text, []

    a_to_e = marker_matches[first_a_index:first_a_index + 5]
    if len(a_to_e) < 4:
        return text, []

    question_text = normalize_text(text[:a_to_e[0].start()])
    options = []
    for idx, marker in enumerate(a_to_e):
        next_start = a_to_e[idx + 1].start() if idx + 1 < len(a_to_e) else len(text)
        option_text = normalize_text(text[marker.end():next_start])
        if option_text:
            options.append(option_text)

    return question_text, options[:5]


def parse_questions(text, file_name):
    cleaned = remove_noise_lines(clean_pdf_text(text))
    parsed = []
    source_meta = infer_source_from_filename(file_name)

    # Primary parser: capture numbered question blocks first, then split A-E options by marker positions.
    for block_match in QUESTION_BLOCK_RE.finditer(cleaned):
        q_no = int(block_match.group(1))
        block_content = normalize_text(block_match.group(2))
        if not block_content:
            continue

        question_text, options = extract_options_from_block(block_content)
        if not question_text or len(options) < 4:
            # fallback to line parser for this block
            block_lines = [line for line in block_content.splitlines() if normalize_text(line)]
            question = parse_question_block(q_no, block_lines, source_meta)
            if question:
                parsed.append(question)
            continue

        if not is_valid_question_stem(question_text):
            continue

        section = infer_section(f"{question_text} {' '.join(options)}")
        parsed.append(
            {
                "fingerprint": make_fingerprint(question_text, options, "mcq"),
                "questionNumber": q_no,
                "type": "mcq",
                "difficulty": "medium",
                "section": section,
                "topic": section,
                "source": source_meta,
                "question": question_text,
                "options": options[:5],
                "answer": "",
                "answerKey": "",
                "explanation": "",
            }
        )

    # Fallback regex parser for hard-wrapped PDFs where line parser fails.
    if len(parsed) < 5:
        fallback = []
        for block in REGEX_BLOCK_RE.finditer(cleaned):
            q_no = int(block.group(1))
            question_text = normalize_text(block.group(2))
            options = [normalize_text(block.group(i)) for i in range(3, 7)]
            if not question_text or len([opt for opt in options if opt]) < 4:
                continue
            section = infer_section(f"{question_text} {' '.join(options)}")
            fallback.append(
                {
                    "fingerprint": make_fingerprint(question_text, options, "mcq"),
                    "questionNumber": q_no,
                    "type": "mcq",
                    "difficulty": "medium",
                    "section": section,
                    "topic": section,
                    "source": source_meta,
                    "question": question_text,
                    "options": options,
                    "answer": "",
                    "answerKey": "",
                    "explanation": "",
                }
            )
        if len(fallback) > len(parsed):
            return fallback

    return parsed


def extract_pdf_questions(pdf_path):
    full_text = []
    pages_count = 0
    with pdfplumber.open(pdf_path) as pdf:
        pages_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)
    merged = "\n".join(full_text)
    parsed = parse_questions(merged, Path(pdf_path).name)
    if not parsed and pages_count > 0:
        print(f"[warn] 0 questions parsed from {Path(pdf_path).name}. This PDF may be image/scanned (OCR needed).")
    return parsed


def process_pdf_folder(paper_folder):
    files = sorted([name for name in os.listdir(paper_folder) if name.lower().endswith(".pdf")])
    all_questions = []
    per_file_stats = []

    for file_name in tqdm(files, desc="Processing PDFs"):
        file_path = os.path.join(paper_folder, file_name)
        questions = extract_pdf_questions(file_path)
        per_file_stats.append({"file": file_name, "extracted": len(questions)})
        print(f"{file_name} -> {len(questions)} questions")
        all_questions.extend(questions)

    return all_questions, per_file_stats


def dedupe_questions(questions):
    unique = []
    seen = set()
    duplicates_skipped = 0

    for item in questions:
        key = item.get("fingerprint")
        if not key or key in seen:
            duplicates_skipped += 1
            continue
        seen.add(key)
        unique.append(item)

    return unique, duplicates_skipped


def write_dataset_chunked(
    questions,
    output_folder,
    exam_slug,
    stage_slug,
    domain,
    provider,
    test_id_prefix,
    test_title_prefix,
    prompt_context,
    chunk_size,
):
    os.makedirs(output_folder, exist_ok=True)
    if chunk_size <= 0:
        chunk_size = len(questions) or 1

    chunk_paths = []
    total_chunks = (len(questions) + chunk_size - 1) // chunk_size

    for idx in range(total_chunks):
        start = idx * chunk_size
        end = min((idx + 1) * chunk_size, len(questions))
        chunk = questions[start:end]
        part_no = idx + 1
        payload = {
            "examSlug": exam_slug,
            "stageSlug": stage_slug,
            "domain": domain,
            "provider": provider,
            "testId": f"{test_id_prefix}-part-{part_no:03d}",
            "testTitle": f"{test_title_prefix} (Part {part_no})",
            "promptContext": prompt_context,
            "questions": chunk,
        }
        output_path = os.path.join(output_folder, f"{test_id_prefix}-part-{part_no:03d}.json")
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        chunk_paths.append(output_path)

    return chunk_paths


def write_report(output_folder, report):
    path = os.path.join(output_folder, "extraction-report.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    return path


def parse_args():
    parser = argparse.ArgumentParser(description="Extract MCQ questions from PDF papers and output import-ready JSON.")
    parser.add_argument("--paper-folder", default="papers", help="Folder containing input PDF files.")
    parser.add_argument("--output-folder", default="output", help="Folder for output JSON files.")
    parser.add_argument("--exam-slug", default="sbi-clerk")
    parser.add_argument("--stage-slug", default="prelims")
    parser.add_argument("--domain", default="Government Exam - SBI Clerk")
    parser.add_argument("--provider", default="pyq-extractor")
    parser.add_argument("--test-id-prefix", default="sbi-clerk-pyq-dataset")
    parser.add_argument("--test-title-prefix", default="SBI Clerk Previous Year Questions")
    parser.add_argument("--prompt-context", default="Extracted from exam papers")
    parser.add_argument("--chunk-size", type=int, default=1000, help="Questions per output JSON file.")
    return parser.parse_args()


def main():
    args = parse_args()
    os.makedirs(args.output_folder, exist_ok=True)

    if not os.path.isdir(args.paper_folder):
        raise FileNotFoundError(f"Paper folder not found: {args.paper_folder}")

    extracted, file_stats = process_pdf_folder(args.paper_folder)
    unique, duplicates_skipped = dedupe_questions(extracted)

    chunk_paths = write_dataset_chunked(
        questions=unique,
        output_folder=args.output_folder,
        exam_slug=args.exam_slug,
        stage_slug=args.stage_slug,
        domain=args.domain,
        provider=args.provider,
        test_id_prefix=args.test_id_prefix,
        test_title_prefix=args.test_title_prefix,
        prompt_context=args.prompt_context,
        chunk_size=args.chunk_size,
    )

    report = {
        "paperFolder": args.paper_folder,
        "outputFolder": args.output_folder,
        "filesProcessed": len(file_stats),
        "perFile": file_stats,
        "totalExtracted": len(extracted),
        "uniqueAfterDedupe": len(unique),
        "duplicatesSkipped": duplicates_skipped,
        "chunkSize": args.chunk_size,
        "outputFiles": chunk_paths,
    }
    report_path = write_report(args.output_folder, report)

    print(f"Total extracted: {len(extracted)}")
    print(f"Unique after dedupe: {len(unique)}")
    print(f"Duplicates skipped: {duplicates_skipped}")
    print(f"Output files: {len(chunk_paths)}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
