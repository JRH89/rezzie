import { useEffect } from "react";
import { BrandMark } from "./BrandMark";

type PageKind = "about" | "features" | "faq" | "blog" | "keyword-tailoring" | "honest-resume-tailoring" | "job-description";

const articles = {
  "keyword-tailoring": { title: "How to tailor resume keywords without keyword stuffing", description: "A practical guide to matching a resume to a job description while keeping every claim accurate.", body: ["A useful keyword belongs in a sentence that describes work you actually did. Start by grouping a job description into responsibilities, tools, and outcomes; then locate the evidence already present in your resume.", "Prefer the employer’s clear language where it is truthful. If a role asks for stakeholder management and you coordinated decisions across teams, make that contribution easy to find. Do not add a tool, certification, or metric merely because it appears in the posting.", "Read the final document as a recruiter would. The important skills should be visible early, but the resume should still sound like one coherent account of your work."] },
  "honest-resume-tailoring": { title: "What honest AI resume tailoring should and should not change", description: "Learn the line between clearer positioning and invented experience in an AI-tailored resume.", body: ["Tailoring can change emphasis, order, headings, and phrasing. It can connect a supported accomplishment to a role’s stated need. It cannot create a new employer, qualification, result, date, title, or technical skill.", "A good review asks one simple question of each strong claim: could you explain or substantiate it in an interview? If not, remove it or rewrite it more carefully.", "Use AI for comparison and editing, then keep the final decision with the candidate. The resume should be more relevant, not less recognizably yours."] },
  "job-description": { title: "A simple way to read a job description before rewriting your resume", description: "Break a job description into priorities so your resume responds to the role with clarity.", body: ["Separate must-have requirements from preferred qualifications and recurring themes. Repeated concepts are usually more useful than an isolated buzzword.", "Next, map each priority to a specific project, responsibility, or outcome in your existing resume. If there is no honest match, do not force one; prepare to address the gap in a cover letter or interview instead.", "Finally, lead with the most relevant supported work. That is tailoring: making the signal easier to see."] }
} as const;

function Seo({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} | Rezzie`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.append(meta); }
    meta.setAttribute("content", description);
  }, [description, title]);
  return null;
}

function Header({ onStart }: { onStart: () => void }) {
  return <header className="marketing-header"><a className="brand-link" href="/" aria-label="Rezzie home"><BrandMark /></a><nav className="marketing-nav" aria-label="Main navigation"><a href="/features">Features</a><a href="/about">About</a><a href="/blog">Resources</a><a href="/faq">FAQ</a></nav><button className="button button-dark button-small" onClick={onStart} type="button">Get started <span aria-hidden="true">↗</span></button></header>;
}

export function MarketingPage({ kind, onStart }: { kind: PageKind; onStart: () => void }) {
  if (kind in articles) {
    const article = articles[kind as keyof typeof articles];
    return <div className="landing"><Seo title={article.title} description={article.description} /><Header onStart={onStart} /><main className="content-page article-page"><p className="eyebrow">REZZIE GUIDES</p><h1>{article.title}</h1><p className="page-lede">{article.description}</p>{article.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<aside className="article-cta"><strong>Ready to tailor an honest draft?</strong><button className="button button-primary" onClick={onStart} type="button">Open Rezzie →</button></aside></main></div>;
  }
  const page = {
    about: { title: "About Rezzie", description: "Rezzie helps candidates tailor their existing resume to a specific job description without inventing experience.", heading: "A better match should still be your story.", lead: "Rezzie exists for candidates who want a clearer, more relevant resume without handing their professional history over to an AI improviser." },
    features: { title: "Resume tailoring features", description: "See how Rezzie imports resumes and job descriptions, identifies supported relevance, and produces editable exports.", heading: "Tools for a sharper, truthful application.", lead: "One focused workspace for turning an existing resume into a role-specific draft you can inspect and edit." },
    faq: { title: "Resume tailoring FAQ", description: "Answers to common questions about Rezzie, AI resume tailoring, privacy, supported claims, and exports.", heading: "Questions, answered plainly.", lead: "What Rezzie changes, what it will not change, and how you remain in control." },
    blog: { title: "Resume tailoring guides", description: "Practical guides for tailoring an honest resume, reading job descriptions, and using keywords with context.", heading: "Practical guidance for the next application.", lead: "Short, useful notes on making your real experience easier for the right employer to find." }
  }[kind as "about" | "features" | "faq" | "blog"];
  const sections = kind === "features" ? [["Bring your sources", "Import a resume and job description as text, PDF, DOCX, or a public job link."], ["Keep claims grounded", "Rezzie reorganizes and clarifies supplied experience; it does not add credentials, metrics, or achievements."], ["Review and export", "Edit the result in your browser and download TXT, DOCX, or PDF."]] : kind === "faq" ? [["Will Rezzie write things I did not do?", "No. It is designed to tailor existing evidence, not invent experience."], ["Can I use my own Anthropic key?", "Yes. A key supplied for a request is used transiently and is not saved."], ["Can I edit the result?", "Yes. Review every draft in the editor before downloading it."]] : [["The product principle", "Clarity is valuable; fiction is not. Every improvement should remain anchored in the candidate’s own source material."], ["Built for review", "The final resume is a draft for the candidate to inspect, revise, and own."], ["Privacy-minded by design", "Resume content, job descriptions, and user-provided keys are treated as sensitive data."]];
  return <div className="landing"><Seo title={page.title} description={page.description} /><Header onStart={onStart} /><main className="content-page"><p className="eyebrow">REZZIE</p><h1>{page.heading}</h1><p className="page-lede">{page.lead}</p>{kind === "blog" ? <div className="article-grid">{Object.entries(articles).map(([slug, article]) => <a className="article-card" href={`/blog/${slug}`} key={slug}><p className="eyebrow">GUIDE</p><h2>{article.title}</h2><p>{article.description}</p><span>Read guide →</span></a>)}</div> : <div className="content-grid">{sections.map(([heading, copy]) => <article key={heading}><h2>{heading}</h2><p>{copy}</p></article>)}</div>}<button className="button button-primary page-cta" onClick={onStart} type="button">Start tailoring →</button></main></div>;
}
