import { readFileSync, statSync } from "node:fs";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { blogPostsTable, cakesTable, db } from "@workspace/db";
import { logger } from "./logger";
import { normalizeSupabaseMediaUrl } from "./media-urls";

const SITE_NAME = "Channah Cake House";

// The address search engines and link previews should use: the live domain from PUBLIC_APP_URL,
// otherwise the address the page was opened on.
export function siteUrl(req: Request) {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;
  const host = req.get("host") ?? "localhost";
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"}://${host}`;
}

// Customer and staff pages stay out of search results.
function isPrivatePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/orders" ||
    pathname === "/account" ||
    pathname.startsWith("/order/")
  );
}

type PageMeta = {
  status: number;
  canonicalPath: string;
  title?: string;
  description?: string;
  image?: string | null;
  type?: string;
  noindex?: boolean;
};

function summarize(text: string, maxLength = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function parseVariantPrices(value: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed.map((variant) => Number(variant?.price)).filter((price) => Number.isFinite(price)) : [];
  } catch {
    return [];
  }
}

async function pageMeta(pathname: string): Promise<PageMeta> {
  if (pathname === "/") return { status: 200, canonicalPath: "/" };
  if (pathname === "/blog") return { status: 200, canonicalPath: "/blog", title: `Blog | ${SITE_NAME}` };
  if (isPrivatePath(pathname)) return { status: 200, canonicalPath: pathname, noindex: true };

  const cakeMatch = pathname.match(/^\/cake\/(\d+)$/);
  if (cakeMatch) {
    const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, Number(cakeMatch[1])));
    if (!cake) return { status: 404, canonicalPath: pathname, noindex: true };
    const sizePrices = parseVariantPrices(cake.variants);
    const price = sizePrices.length > 0 ? `From ${formatKes(Math.min(...sizePrices))}` : formatKes(parseFloat(cake.price));
    return {
      status: 200,
      canonicalPath: pathname,
      title: `${cake.name} | ${SITE_NAME}`,
      description: summarize(`${cake.name} — ${price}. ${cake.description?.trim() || "Handmade to order in Mombasa."}`),
      image: normalizeSupabaseMediaUrl(cake.imageUrl),
      type: "product",
    };
  }

  const postMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (postMatch) {
    const [post] = await db
      .select()
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.slug, decodeURIComponent(postMatch[1])), eq(blogPostsTable.published, true)));
    if (!post) return { status: 404, canonicalPath: pathname, noindex: true };
    return {
      status: 200,
      canonicalPath: pathname,
      title: `${post.title} | ${SITE_NAME}`,
      description: summarize(post.excerpt?.trim() || post.content),
      image: normalizeSupabaseMediaUrl(post.coverImageUrl),
      type: "article",
    };
  }

  // Any other address shows the shop's "page not found" screen.
  return { status: 404, canonicalPath: pathname, noindex: true };
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setMeta(html: string, attribute: "name" | "property", key: string, value: string) {
  const tag = `<meta ${attribute}="${key}" content="${escapeAttribute(value)}" />`;
  const pattern = new RegExp(`<meta ${attribute}="${escapeRegExp(key)}" content="[^"]*"\\s*/?>`);
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

let cachedTemplate: { mtimeMs: number; html: string } | null = null;

function loadTemplate(templateFile: string) {
  // Kept in memory, but re-read whenever the file changes (a rebuild renames the scripts it loads).
  const { mtimeMs } = statSync(templateFile);
  if (!cachedTemplate || cachedTemplate.mtimeMs !== mtimeMs) {
    cachedTemplate = { mtimeMs, html: readFileSync(templateFile, "utf8") };
  }
  return cachedTemplate.html;
}

// The shop's index.html with the right address, title, description and preview image for this page,
// so search engines and WhatsApp/Facebook link previews (which don't run JavaScript) see them.
export async function renderStorefrontPage(req: Request, templateFile: string) {
  const base = siteUrl(req);
  const meta: PageMeta = await pageMeta(req.path).catch((err): PageMeta => {
    logger.warn({ err, path: req.path }, "Page details unavailable; using the defaults");
    return { status: 200, canonicalPath: req.path };
  });
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`);
  const canonical = `${base}${meta.canonicalPath}`;

  let html = loadTemplate(templateFile)
    // Link previews and structured data need absolute image addresses.
    .replaceAll('"/api/media?path=', `"${base}/api/media?path=`)
    .replace(/"url": "[^"]*"/, `"url": "${base}/"`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeAttribute(canonical)}" />`);
  html = setMeta(html, "property", "og:url", canonical);

  if (meta.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(meta.title)}</title>`);
    html = setMeta(html, "property", "og:title", meta.title);
    html = setMeta(html, "name", "twitter:title", meta.title);
  }
  if (meta.description) {
    html = setMeta(html, "name", "description", meta.description);
    html = setMeta(html, "property", "og:description", meta.description);
    html = setMeta(html, "name", "twitter:description", meta.description);
  }
  if (meta.image) {
    html = setMeta(html, "property", "og:image", absolute(meta.image));
    html = setMeta(html, "name", "twitter:image", absolute(meta.image));
  }
  if (meta.type) html = setMeta(html, "property", "og:type", meta.type);
  if (meta.noindex) html = setMeta(html, "name", "robots", "noindex");

  return { status: meta.status, html };
}

export function renderRobotsTxt(base: string) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /login",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order/",
    "Disallow: /orders",
    "Disallow: /account",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

export async function renderSitemap(base: string) {
  const [cakes, posts] = await Promise.all([
    db.select({ id: cakesTable.id, updatedAt: cakesTable.updatedAt }).from(cakesTable).where(eq(cakesTable.available, true)),
    db
      .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.published, true)),
  ]);
  const entries = [
    { loc: `${base}/`, lastmod: null as Date | null },
    ...cakes.map((cake) => ({ loc: `${base}/cake/${cake.id}`, lastmod: cake.updatedAt })),
    ...(posts.length > 0 ? [{ loc: `${base}/blog`, lastmod: null }] : []),
    ...posts.map((post) => ({ loc: `${base}/blog/${encodeURIComponent(post.slug)}`, lastmod: post.updatedAt })),
  ];
  const urls = entries
    .map(({ loc, lastmod }) => `  <url><loc>${escapeAttribute(loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
