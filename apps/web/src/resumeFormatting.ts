import type { ResumeStyleProfile, TailoringChange } from "./api";

const sectionHeadings = new Set([
  "SUMMARY",
  "PROFESSIONAL SUMMARY",
  "CAREER SUMMARY",
  "PROFILE",
  "PROFESSIONAL PROFILE",
  "CAREER PROFILE",
  "OBJECTIVE",
  "SKILLS",
  "CORE SKILLS",
  "TECHNICAL SKILLS",
  "TECHNICAL PROFICIENCIES",
  "EXPERIENCE",
  "PROFESSIONAL EXPERIENCE",
  "RELEVANT EXPERIENCE",
  "SELECTED EXPERIENCE",
  "WORK EXPERIENCE",
  "WORK HISTORY",
  "EMPLOYMENT",
  "EMPLOYMENT HISTORY",
  "CAREER HISTORY",
  "PROFESSIONAL BACKGROUND",
  "PROJECTS",
  "SELECTED PROJECTS",
  "SELECTED PRODUCTS",
  "ACADEMIC PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
  "AWARDS",
  "VOLUNTEERING",
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const urlPattern = /(?:https?:\/\/|www\.|mailto:)[^\s<>"']+/giu;

function linkify(value: string) {
  let output = "";
  let cursor = 0;
  for (const match of value.matchAll(urlPattern)) {
    const matched = match[0];
    const trailing = matched.match(/[.,;:!?]+$/u)?.[0] ?? "";
    const visibleUrl = matched.slice(0, matched.length - trailing.length);
    const href = visibleUrl.startsWith("www.")
      ? `https://${visibleUrl}`
      : visibleUrl;
    output += `${escapeHtml(value.slice(cursor, match.index))}<a href="${escapeHtml(href)}" rel="noreferrer" target="_blank">${escapeHtml(visibleUrl)}</a>${escapeHtml(trailing)}`;
    cursor = (match.index ?? 0) + matched.length;
  }
  return `${output}${escapeHtml(value.slice(cursor))}`;
}

const bulletPrefix = /^(?:[-*]|\u2022|\u2023|\u25e6|\u2013)\s+/u;

function bulletText(line: string) {
  return line.replace(bulletPrefix, "");
}

function isBullet(line: string) {
  return bulletPrefix.test(line);
}

function isRoleLine(line: string) {
  return (
    /(?:\b(?:19|20)\d{2}\b|\bpresent\b)/i.test(line) &&
    /(?:\s[-|–—]\s|\(|\))/u.test(line)
  );
}

function isProjectEntryLine(line: string) {
  return (
    /\|\s*(?:https?:\/\/|www\.)/i.test(line) ||
    /^[A-Z][^-\n]{1,90}\s[-–—]\s.+\([^)]{2,}\)/u.test(line)
  );
}

export function isResumeHeading(line: string) {
  return sectionHeadings.has(
    bulletText(line).replace(":", "").trim().replace(/\s+/g, " ").toUpperCase(),
  );
}

export type ResumeLineChange = {
  kind: "added" | "removed" | "unchanged";
  line: string;
};

function comparableResumeLine(line: string) {
  return bulletText(line).trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * An exact, order-preserving line diff. Unlike model-provided change summaries,
 * this compares the actual source and draft that are on screen.
 */
export function resumeLineDiff(
  sourceText: string,
  tailoredText: string,
): ResumeLineChange[] {
  const source = sourceText.split("\n").map((line) => line.trim()).filter(Boolean);
  const tailored = tailoredText.split("\n").map((line) => line.trim()).filter(Boolean);
  const matrix = Array.from({ length: source.length + 1 }, () =>
    Array<number>(tailored.length + 1).fill(0),
  );

  for (let sourceIndex = source.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
    for (let draftIndex = tailored.length - 1; draftIndex >= 0; draftIndex -= 1) {
      matrix[sourceIndex][draftIndex] =
        comparableResumeLine(source[sourceIndex]) ===
        comparableResumeLine(tailored[draftIndex])
          ? matrix[sourceIndex + 1][draftIndex + 1] + 1
          : Math.max(
              matrix[sourceIndex + 1][draftIndex],
              matrix[sourceIndex][draftIndex + 1],
            );
    }
  }

  const changes: ResumeLineChange[] = [];
  let sourceIndex = 0;
  let draftIndex = 0;
  while (sourceIndex < source.length || draftIndex < tailored.length) {
    if (
      sourceIndex < source.length &&
      draftIndex < tailored.length &&
      comparableResumeLine(source[sourceIndex]) ===
        comparableResumeLine(tailored[draftIndex])
    ) {
      changes.push({ kind: "unchanged", line: tailored[draftIndex] });
      sourceIndex += 1;
      draftIndex += 1;
    } else if (
      draftIndex < tailored.length &&
      (sourceIndex === source.length ||
        matrix[sourceIndex][draftIndex + 1] >=
          matrix[sourceIndex + 1][draftIndex])
    ) {
      changes.push({ kind: "added", line: tailored[draftIndex] });
      draftIndex += 1;
    } else if (sourceIndex < source.length) {
      changes.push({ kind: "removed", line: source[sourceIndex] });
      sourceIndex += 1;
    }
  }
  return changes;
}

function isAchievementSection(line: string) {
  const normalized = line.replace(":", "").trim().toUpperCase();
  return (
    normalized.includes("EXPERIENCE") ||
    normalized.includes("PROJECT") ||
    normalized.includes("VOLUNTEER")
  );
}

export function resumeEditorHtml(
  text: string,
  changes: TailoringChange[] = [],
  styleProfile?: ResumeStyleProfile,
  entryLines: string[] = [],
  reviewAddedLines: string[] = [],
) {
  const sourceBacked = new Set(
    changes
      .filter((change) => change.kind === "source_backed")
      .map((change) => change.text.trim()),
  );
  const blocks: string[] = [];
  let bullets: string[] = [];
  let contentIndex = 0;
  let achievementSection = false;
  let hasEntryLine = false;
  const addedLineCounts = new Map<string, number>();
  for (const line of reviewAddedLines) {
    const key = comparableResumeLine(line);
    addedLineCounts.set(key, (addedLineCounts.get(key) ?? 0) + 1);
  }
  const flushBullets = () => {
    if (bullets.length) blocks.push(`<ul>${bullets.join("")}</ul>`);
    bullets = [];
  };
  const render = (line: string) => {
    const linked = linkify(line);
    const sourceMarked = sourceBacked.has(line)
      ? `<mark class="source-backed-highlight">${linked}</mark>`
      : linked;
    const key = comparableResumeLine(line);
    const count = addedLineCounts.get(key) ?? 0;
    if (!count) return sourceMarked;
    addedLineCounts.set(key, count - 1);
    return `<mark class="resume-change-added" data-review-action="remove" title="Undo this added line">${sourceMarked}<button aria-label="Undo added line" class="resume-diff-badge" contenteditable="false" type="button">↶</button></mark>`;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    if (isResumeHeading(line)) {
      flushBullets();
      const heading = bulletText(line);
      const rendered = render(heading);
      blocks.push(
        `<h3>${styleProfile?.heading_uppercase ? rendered.replace(/:$/, "").toUpperCase() : rendered.replace(/:$/, "")}</h3>`,
      );
      achievementSection = isAchievementSection(heading);
      hasEntryLine = false;
      contentIndex += 1;
      continue;
    }
    if (isBullet(line)) {
      bullets.push(`<li>${render(bulletText(line))}</li>`);
      contentIndex += 1;
      continue;
    }
    if (
      achievementSection &&
      hasEntryLine &&
      !isRoleLine(line) &&
      !isProjectEntryLine(line) &&
      !entryLines.includes(line)
    ) {
      bullets.push(`<li>${render(line)}</li>`);
      contentIndex += 1;
      continue;
    }
    flushBullets();
    const rendered = render(line);
    if (contentIndex === 0) blocks.push(`<h1>${rendered}</h1>`);
    else if (contentIndex === 1) blocks.push(`<p>${rendered}</p>`);
    else if (
      isRoleLine(line) ||
      (styleProfile?.emphasize_role_lines && /\s[|–—]\s/u.test(line))
    ) {
      blocks.push(`<p><strong>${rendered}</strong></p>`);
      hasEntryLine = true;
    } else if (achievementSection) {
      blocks.push(`<p><strong>${rendered}</strong></p>`);
      hasEntryLine = true;
    } else blocks.push(`<p>${rendered}</p>`);
    contentIndex += 1;
  }
  flushBullets();
  return blocks.join("");
}
