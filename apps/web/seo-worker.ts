import { blogPosts } from "./src/blog";

type PageMeta = { description: string; image: string; title: string; type?: "article" | "website" };
type WorkerEnv = { ASSETS: { fetch: (request: Request) => Promise<Response> } };

const siteUrl = "https://rezzie.org";
const pageMetaByPath: Record<string, PageMeta> = {
  "/": { title: "AI Resume Tailoring That Keeps Your Experience True", description: "Tailor your resume to each job description with accurate keywords, reviewable edits, and PDF or DOCX exports—without making up experience.", image: "/social/home.png" },
  "/about": { title: "About Rezzie — Truthful AI Resume Tailoring", description: "Learn how Rezzie helps job seekers tailor resumes to each role with accurate keywords and clear positioning—without inventing experience.", image: "/social/about.png" },
  "/chrome-extension": { title: "Chrome Extension for AI Resume Tailoring", description: "Tailor your resume beside a job listing. Rezzie reads the page only when you ask, uses your saved resume, and keeps every claim grounded.", image: "/social/chrome-extension.png" },
  "/features": { title: "AI Resume Tailoring Features", description: "Import your resume and a job description, match the right keywords to real experience, edit with confidence, and export PDF or DOCX.", image: "/social/features.png" },
  "/how-it-works": { title: "How to Tailor Your Resume to a Job Description", description: "See how to tailor a resume in three clear steps: add your experience, add the job description, then review and export a truthful draft.", image: "/social/how-it-works.png" },
  "/pricing": { title: "AI Resume Tailoring Pricing", description: "Use your own Anthropic key free, buy 20 resume-tailoring credits for $5, or get 50 monthly credits for $9.99.", image: "/social/pricing.png" },
  "/privacy": { title: "Privacy Policy", description: "Learn how Rezzie handles account information, resumes, job descriptions, saved drafts, and Chrome extension data.", image: "/social/privacy.png" },
  "/safety": { title: "Truthful AI Resume Tailoring", description: "Learn how Rezzie keeps AI resume tailoring grounded in your supplied experience, with review controls that prevent made-up claims.", image: "/social/safety.png" },
  "/faq": { title: "AI Resume Tailoring FAQ", description: "Get answers about truthful AI resume tailoring, file imports, editing, exports, credits, and using your own Anthropic key.", image: "/social/faq.png" },
  "/blog": { title: "Resume Tailoring Tips and Job Search Guides", description: "Practical resume tailoring tips, job-description guidance, and keyword strategies to help you make a stronger, truthful case for each role.", image: "/social/blog.png" },
};

function metaForPath(pathname: string): PageMeta | undefined {
  const direct = pageMetaByPath[pathname];
  if (direct) return direct;
  const slug = pathname.startsWith("/blog/") ? pathname.slice("/blog/".length) : "";
  const post = blogPosts.find((item) => item.slug === slug);
  return post ? { title: post.title, description: post.description, image: "/social/blog.png", type: "article" } : undefined;
}

function setContent(element: Element, content: string) { element.setAttribute("content", content); }

function rewriteDocument(response: Response, meta: PageMeta, url: URL) {
  const canonicalUrl = `${siteUrl}${url.pathname}`;
  const imageUrl = `${siteUrl}${meta.image}`;
  const title = `${meta.title} | Rezzie`;
  const imageAlt = `Rezzie: ${meta.title}`;
  return new HTMLRewriter()
    .on("title", { element: (element) => element.setInnerContent(title) })
    .on('meta[name="description"]', { element: (element) => setContent(element, meta.description) })
    .on('meta[name="robots"]', { element: (element) => setContent(element, "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1") })
    .on('meta[property="og:type"]', { element: (element) => setContent(element, meta.type ?? "website") })
    .on('meta[property="og:title"]', { element: (element) => setContent(element, meta.title) })
    .on('meta[property="og:description"]', { element: (element) => setContent(element, meta.description) })
    .on('meta[property="og:url"]', { element: (element) => setContent(element, canonicalUrl) })
    .on('meta[property="og:image"]', { element: (element) => setContent(element, imageUrl) })
    .on('meta[property="og:image:alt"]', { element: (element) => setContent(element, imageAlt) })
    .on('meta[name="twitter:title"]', { element: (element) => setContent(element, meta.title) })
    .on('meta[name="twitter:description"]', { element: (element) => setContent(element, meta.description) })
    .on('meta[name="twitter:url"]', { element: (element) => setContent(element, canonicalUrl) })
    .on('meta[name="twitter:image"]', { element: (element) => setContent(element, imageUrl) })
    .on('meta[name="twitter:image:alt"]', { element: (element) => setContent(element, imageAlt) })
    .on('link[rel="canonical"]', { element: (element) => element.setAttribute("href", canonicalUrl) })
    .on("head", { element: (element) => { if (meta.type === "article") element.append(`<meta property="article:published_time" content="${blogPosts.find((item) => item.title === meta.title)?.publishedAt}T12:00:00Z"><meta property="article:author" content="Rezzie">`, { html: true }); } })
    .transform(response);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const meta = request.method === "GET" && response.headers.get("content-type")?.includes("text/html") ? metaForPath(url.pathname) : undefined;
    return meta ? rewriteDocument(response, meta, url) : response;
  },
};
