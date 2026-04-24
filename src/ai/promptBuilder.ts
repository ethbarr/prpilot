import { DiffFile, Settings, ReviewStyle } from '../types';

const STYLE_INSTRUCTIONS: Record<ReviewStyle, string> = {
  general:
    'Perform a balanced review covering correctness, readability, maintainability, and obvious bugs.',
  security:
    'Focus specifically on security vulnerabilities: injection risks, hardcoded secrets, authentication flaws, insecure defaults, and exposure of sensitive data.',
  performance:
    'Focus on performance concerns: unnecessary re-renders, N+1 queries, missing indexes, blocking I/O, memory leaks, and algorithmic complexity.',
  concise:
    'Be extremely brief. Only flag high-severity issues. Skip praise and minor suggestions.',
};

/**
 * Builds the system + user prompt for the AI code review.
 */
export function buildReviewPrompt(files: DiffFile[], settings: Settings): string {
  const styleInstruction = STYLE_INSTRUCTIONS[settings.reviewStyle];

  const diffSection = files
    .map((file) => {
      const patch = file.patch ?? '[binary or too large to display — skip this file]';
      return `### ${file.filename} (${file.status}, +${file.additions} -${file.deletions})\n\`\`\`diff\n${patch}\n\`\`\``;
    })
    .join('\n\n');

  return `You are a senior software engineer performing a pull request code review.

${styleInstruction}

Review the following diff and respond with ONLY a valid JSON object — no markdown fences, no prose before or after — matching this exact schema:

{
  "summary": "<2-3 sentence overview of the change>",
  "comments": [
    {
      "type": "<issue | suggestion | praise>",
      "severity": "<high | medium | low | info>",
      "file": "<filename or omit if general>",
      "message": "<specific, actionable comment>"
    }
  ],
  "overallScore": <integer 1-10>
}

Rules:
- "issue" = a bug, security flaw, or correctness problem
- "suggestion" = an improvement that is not strictly wrong
- "praise" = something done well (include at least one if warranted)
- severity "high" = must fix before merge; "medium" = should fix; "low" = minor; "info" = FYI
- overallScore: 10 = perfect, 7 = good with minor issues, 4 = significant problems, 1 = do not merge

## Pull Request Diff

${diffSection}`;
}
