import type { ResumeStyleProfile, TailoringChange } from "./api";

const sectionHeadings = new Set([
  "SUMMARY", "PROFESSIONAL SUMMARY", "CAREER SUMMARY", "PROFILE", "PROFESSIONAL PROFILE", "CAREER PROFILE", "OBJECTIVE",
  "SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "TECHNICAL PROFICIENCIES", "EXPERIENCE", "PROFESSIONAL EXPERIENCE",
  "RELEVANT EXPERIENCE", "SELECTED EXPERIENCE", "WORK EXPERIENCE", "WORK HISTORY", "EMPLOYMENT", "EMPLOYMENT HISTORY",
  "CAREER HISTORY", "PROFESSIONAL BACKGROUND", "PROJECTS", "ACADEMIC PROJECTS", "EDUCATION", "CERTIFICATIONS", "AWARDS", "VOLUNTEERING",
]);

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const bulletPrefix = /^(?:[-*]|\u2022|\u2023|\u25e6|\u2013)\s+/u;

function bulletText(line: string) {
  return line.replace(bulletPrefix, "");
}

function isBullet(line: string) {
  return bulletPrefix.test(line);
}

function isRoleLine(line: string) {
  return /(?:\b(?:19|20)\d{2}\b|\bpresent\b)/i.test(line) && /(?:\s[-|–—]\s|\(|\))/u.test(line);
}

function isProjectEntryLine(line: string) {
  return /\|\s*(?:https?:\/\/|www\.)/i.test(line) || /^[A-Z][^-\n]{1,90}\s[-–—]\s.+\([^)]{2,}\)/u.test(line);
}

export function isResumeHeading(line: string) {
  return sectionHeadings.has(line.replace(":", "").trim().replace(/\s+/g, " ").toUpperCase());
}

function isAchievementSection(line: string) {
  const normalized = line.replace(":", "").trim().toUpperCase();
  return normalized.includes("EXPERIENCE") || normalized.includes("PROJECT") || normalized.includes("VOLUNTEER");
}

export function resumeEditorHtml(text: string, changes: TailoringChange[] = [], styleProfile?: ResumeStyleProfile, entryLines: string[] = []) {
  const sourceBacked = new Set(changes.filter(change => change.kind === "source_backed").map(change => change.text.trim()));
  const blocks: string[] = [];
  let bullets: string[] = [];
  let contentIndex = 0;
  let achievementSection = false;
  let hasEntryLine = false;
  const flushBullets = () => {
    if (bullets.length) blocks.push(`<ul>${bullets.join("")}</ul>`);
    bullets = [];
  };
  const render = (line: string) => {
    const escaped = escapeHtml(line);
    return sourceBacked.has(line) ? `<mark class="source-backed-highlight">${escaped}</mark>` : escaped;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    if (isResumeHeading(line)) {
      flushBullets();
      const rendered = render(line);
      blocks.push(`<h3>${styleProfile?.heading_uppercase ? rendered.replace(/:$/, "").toUpperCase() : rendered.replace(/:$/, "")}</h3>`);
      achievementSection = isAchievementSection(line);
      hasEntryLine = false;
      contentIndex += 1;
      continue;
    }
    if (isBullet(line)) {
      bullets.push(`<li>${escapeHtml(bulletText(line))}</li>`);
      contentIndex += 1;
      continue;
    }
    if (achievementSection && hasEntryLine && !isRoleLine(line) && !isProjectEntryLine(line) && !entryLines.includes(line)) {
      bullets.push(`<li>${render(line)}</li>`);
      contentIndex += 1;
      continue;
    }
    flushBullets();
    const rendered = render(line);
    if (contentIndex === 0) blocks.push(`<h1>${rendered}</h1>`);
    else if (contentIndex === 1) blocks.push(`<p>${rendered}</p>`);
    else if (isRoleLine(line) || (styleProfile?.emphasize_role_lines && /\s[|–—]\s/u.test(line))) {
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
