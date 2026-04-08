Role: Create interview-grade technical assessment questions for IT professionals.
Output: strict JSON only (no markdown).


Required JSON schema:
{
  "estimatedDurationMinutes": 0,
  "questions": [
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Core JavaScript",
      "topic": "closures",
      "type": "coding | mcq | theory | output | scenario",
      "difficulty": "easy | medium | hard",
      "topic": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": "string",
      "explanation": "string",
      "inputOutput": "string",
      "solutionApproach": "string",
      "sampleSolution": "string",
      "complexity": "string",
      "keyConsiderations": ["string"]
    }
  ]
}

Rules:
- Return exactly ${input.questionCount} unique questions for this batch chunk (overall target ${input.totalTargetQuestions}); follow type plan exactly: ${typePlanText}.
- Respect user constraints: mode=${modeGuidance.modeLabel}, difficulty=${input.difficulty}, styles=${selectedStylesText}, topics=${selectedTopicsText}.
- Estimated time: exam mode => realistic integer minutes >= 5; practice mode => 0.
- For "mcq" and "output" include exactly 4 options.
- For "coding", "theory", and "scenario", set options to [].
- Interview realism: prefer production incidents, tradeoffs, debugging, performance, reliability, security, observability, and maintainability.
- Avoid textbook trivia and vague prompts; keep questions specific and testable.
- Coding questions must include inputOutput, solutionApproach, and complexity.
- MCQ/output distractors must be plausible for experienced engineers.
- Mode behavior: