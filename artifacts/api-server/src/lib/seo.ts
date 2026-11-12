import { readFileSync, statSync } from "node:fs";
import type { Request } from "express";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { blogPostsTable, cakesTable, categoriesTable, db, ensureReviewsSchema, reviewsTable } from "@workspace/db";
import { cakeSizes, readCakeOptions } from "./cake-options";
import { mediaForCakes } from "./cake-media";
import { logger } from "./logger";
import { normalizeSupabaseMediaUrl } from "./media-urls";

const SITE_NAME = "Channah Cake House";
const HOME_TITLE = "Channah Cake House | Birthday & Custom Cakes in Mombasa";
const HOME_DESCRIPTION =
  "Order birthday, wedding and custom cakes in Mombasa from Channah Cake House. Choose your size and flavour online, pay with M-Pesa, and get your cake delivered.";

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
  // Structured data (schema.org) for search results: a cake's price and reviews, a blog post's date.
  jsonLd?: object[];
  // The page's main text and links as plain HTML, shown until the shop's app takes over the page, so search
  // engines and link previews that don't run JavaScript still see it.
  content?: string;
};

// A visitor's scheme as they typed it: Cloudflare says so in CF-Visitor, Railway in X-Forwarded-Proto.
function visitorScheme(req: Request) {
  const visitor = req.get("cf-visitor");
  if (visitor) {
    try {
      const scheme = (JSON.parse(visitor) as { scheme?: unknown }).scheme;
      if (typeof scheme === "string") return scheme.toLowerCase();
    } catch {
      // Not Cloudflare's JSON.
    }
  }
  return (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim().toLowerCase();
}

// One address per page for search engines: http:// and www. go to the live https address (PUBLIC_APP_URL), and a
// trailing slash is dropped (/cake/9/ → /cake/9). Returns where to send the visitor, or null to serve the page.
export function canonicalRedirect(req: Request): string | null {
  let canonical: URL | null = null;
  try {
    const configured = process.env.PUBLIC_APP_URL?.trim();
    canonical = configured ? new URL(configured) : null;
  } catch {
    canonical = null;
  }
  const host = (req.get("host") ?? "").toLowerCase();
  let origin = "";
  if (canonical?.protocol === "https:") {
    const liveHost = canonical.host.toLowerCase();
    if (host === `www.${liveHost}` || (host === liveHost && visitorScheme(req) === "http")) origin = canonical.origin;
  }
  // Leading slashes collapse to one, so //other-site.example/ can never send the visitor to another website.
  const path = req.path.replace(/^\/+/, "/").replace(/(.)\/+$/, "$1");
  if (!origin && path === req.path) return null;
  const queryStart = req.originalUrl.indexOf("?");
  return `${origin}${path}${queryStart >= 0 ? req.originalUrl.slice(queryStart) : ""}`;
}

function summarize(text: string, maxLength = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const absoluteUrl = (base: string, url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`);
const imageUrl = (base: string, url: string | null | undefined) => {
  const normalized = normalizeSupabaseMediaUrl(url);
  return normalized ? absoluteUrl(base, normalized) : null;
};
const plainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// The pre-filled page: plain and readable, replaced by the shop's app as soon as it starts.
const CONTENT_STYLE = "max-width:880px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2b2420;line-height:1.5";
const page = (inner: string) => `<main style="${CONTENT_STYLE}">${inner}</main>`;
const link = (href: string, text: string) => `<a href="${escapeAttribute(href)}" style="color:#c2185b">${escapeAttribute(text)}</a>`;

// Cheapest size and dearest size of a cake (its own sizes, or the shop's standard sizes priced per kg).
function priceRange(cake: { price: string; variants: string | null }, options: Awaited<ReturnType<typeof readCakeOptions>>) {
  const prices = cakeSizes(cake, options).map((size) => size.price);
  const fallback = parseFloat(cake.price);
  if (prices.length === 0) return Number.isFinite(fallback) ? { low: fallback, high: fallback } : null;
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

async function homeMeta(): Promise<PageMeta> {
  const [cakes, categories, options] = await Promise.all([
    db
      .select({ id: cakesTable.id, name: cakesTable.name, price: cakesTable.price, variants: cakesTable.variants, categoryId: cakesTable.categoryId })
      .from(cakesTable)
      .where(eq(cakesTable.available, true))
      .orderBy(asc(cakesTable.id)),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).orderBy(asc(categoriesTable.id)),
    readCakeOptions(),
  ]);
  const cakeItem = (cake: (typeof cakes)[number]) => {
    const range = priceRange(cake, options);
    return `<li>${link(`/cake/${cake.id}`, cake.name)}${range ? ` — from ${formatKes(range.low)}` : ""}</li>`;
  };
  const sections = [
    ...categories.map((category) => ({ name: category.name, cakes: cakes.filter((cake) => cake.categoryId === category.id) })),
    { name: "More cakes", cakes: cakes.filter((cake) => !categories.some((category) => category.id === cake.categoryId)) },
  ].filter((section) => section.cakes.length > 0);
  return {
    status: 200,
    canonicalPath: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    content: page(
      `<h1>Birthday &amp; custom cakes in Mombasa</h1><p>${escapeAttribute(HOME_DESCRIPTION)}</p>` +
        sections.map((section) => `<h2>${escapeAttribute(section.name)}</h2><ul>${section.cakes.map(cakeItem).join("")}</ul>`).join("") +
        `<p>${link("/blog", "Cake ideas and tips on our blog")}</p>`,
    ),
  };
}

async function cakeMeta(id: number, pathname: string, base: string): Promise<PageMeta> {
  const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, id));
  if (!cake) return { status: 404, canonicalPath: pathname, noindex: true };
  const [options, [category], reviews, related, media] = await Promise.all([
    readCakeOptions(),
    cake.categoryId ? db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, cake.categoryId)) : Promise.resolve([]),
    ensureReviewsSchema()
      .then(() =>
        db
          .select({ authorName: reviewsTable.authorName, rating: reviewsTable.rating, body: reviewsTable.body, createdAt: reviewsTable.createdAt })
          .from(reviewsTable)
          .where(and(eq(reviewsTable.cakeId, cake.id), eq(reviewsTable.approved, 1)))
          .orderBy(desc(reviewsTable.createdAt)),
      )
      .catch((): { authorName: string; rating: number; body: string; createdAt: Date }[] => []),
    cake.categoryId
      ? db
          .select({ id: cakesTable.id, name: cakesTable.name })
          .from(cakesTable)
          .where(and(eq(cakesTable.categoryId, cake.categoryId), eq(cakesTable.available, true), ne(cakesTable.id, cake.id)))
          .orderBy(asc(cakesTable.id))
          .limit(6)
      : Promise.resolve([]),
    mediaForCakes([cake.id]),
  ]);
  const sizes = cakeSizes(cake, options);
  const range = priceRange(cake, options);
  const about = cake.description?.trim() || "Handmade to order in Mombasa.";
  const url = `${base}${pathname}`;
  const images = [cake.imageUrl, ...(media.get(cake.id) ?? []).filter((item) => item.type === "image").map((item) => item.url)]
    .map((image) => imageUrl(base, image))
    .filter((image): image is string => !!image);
  const rated = reviews.filter((review) => review.rating >= 1 && review.rating <= 5);
  const average = rated.length ? Math.round((rated.reduce((sum, review) => sum + review.rating, 0) / rated.length) * 10) / 10 : null;
  const availability = cake.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cake.name,
    description: plainText(about),
    url,
    sku: String(cake.id),
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(images.length ? { image: images } : {}),
    ...(category ? { category: category.name } : {}),
    ...(range
      ? {
          offers:
            range.low === range.high
              ? { "@type": "Offer", price: range.low, priceCurrency: "KES", availability, url, seller: { "@type": "Organization", name: SITE_NAME } }
              : {
                  "@type": "AggregateOffer",
                  lowPrice: range.low,
                  highPrice: range.high,
                  offerCount: sizes.length,
                  priceCurrency: "KES",
                  availability,
                  url,
                  seller: { "@type": "Organization", name: SITE_NAME },
                },
        }
      : {}),
    ...(average !== null
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: average, reviewCount: rated.length, bestRating: 5, worstRating: 1 },
          review: rated.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.authorName },
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
            reviewBody: review.body,
            datePublished: review.createdAt.toISOString().slice(0, 10),
          })),
        }
      : {}),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Cakes", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: cake.name, item: url },
    ],
  };

  return {
    status: 200,
    canonicalPath: pathname,
    title: `${cake.name} | Order in Mombasa | ${SITE_NAME}`,
    description: summarize(
      `${cake.name}${range ? `, from ${formatKes(range.low)}` : ""}. ${plainText(about)} Baked to order in Mombasa: choose your size and flavour, pay with M-Pesa.`,
    ),
    image: normalizeSupabaseMediaUrl(cake.imageUrl),
    type: "product",
    jsonLd: [product, breadcrumbs],
    content: page(
      `<p>${link("/", "Cakes")}${category ? ` › ${escapeAttribute(category.name)}` : ""}</p>` +
        `<h1>${escapeAttribute(cake.name)}</h1>` +
        (images[0] ? `<img src="${escapeAttribute(images[0])}" alt="${escapeAttribute(cake.name)}" width="480" height="480" style="max-width:100%;height:auto;border-radius:16px" />` : "") +
        (range ? `<p><strong>From ${formatKes(range.low)}</strong></p>` : "") +
        `<p>${escapeAttribute(plainText(about))}</p>` +
        (sizes.length ? `<h2>Sizes</h2><ul>${sizes.map((size) => `<li>${escapeAttribute(size.label)}: ${formatKes(size.price)}</li>`).join("")}</ul>` : "") +
        (average !== null ? `<p>Rated ${average} out of 5 from ${rated.length} review${rated.length === 1 ? "" : "s"}.</p>` : "") +
        (related.length ? `<h2>You may also like</h2><ul>${related.map((other) => `<li>${link(`/cake/${other.id}`, other.name)}</li>`).join("")}</ul>` : ""),
    ),
  };
}

async function blogMeta(): Promise<PageMeta> {
  const posts = await db
    .select({ slug: blogPostsTable.slug, title: blogPostsTable.title, excerpt: blogPostsTable.excerpt, content: blogPostsTable.content })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.published, true))
    .orderBy(desc(blogPostsTable.publishedAt), desc(blogPostsTable.createdAt));
  const description = "Cake ideas, decorating tips and celebration stories from Channah Cake House, bakers of custom cakes in Mombasa.";
  return {
    status: 200,
    canonicalPath: "/blog",
    title: `Cake Ideas & Tips | ${SITE_NAME} Blog`,
    description,
    content: page(
      `<p>${link("/", "Cakes")}</p><h1>Cake ideas &amp; tips</h1><p>${escapeAttribute(description)}</p>` +
        posts
          .map(
            (post) =>
              `<h2>${link(`/blog/${encodeURIComponent(post.slug)}`, post.title)}</h2><p>${escapeAttribute(summarize(post.excerpt?.trim() || plainText(post.content), 200))}</p>`,
          )
          .join(""),
    ),
  };
}

async function postMeta(slug: string, pathname: string, base: string): Promise<PageMeta> {
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, slug), eq(blogPostsTable.published, true)));
  if (!post) return { status: 404, canonicalPath: pathname, noindex: true };
  const text = plainText(post.content);
  const cover = imageUrl(base, post.coverImageUrl);
  const published = (post.publishedAt ?? post.createdAt).toISOString();
  const logo = `${base}/api/media?path=logo-clear.png`;
  return {
    status: 200,
    canonicalPath: pathname,
    title: `${post.title} | ${SITE_NAME}`,
    description: summarize(post.excerpt?.trim() || text),
    image: normalizeSupabaseMediaUrl(post.coverImageUrl),
    type: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title.slice(0, 110),
        description: summarize(post.excerpt?.trim() || text),
        url: `${base}${pathname}`,
        mainEntityOfPage: `${base}${pathname}`,
        datePublished: published,
        dateModified: post.updatedAt.toISOString(),
        ...(cover ? { image: [cover] } : {}),
        author: { "@type": "Organization", name: SITE_NAME, url: `${base}/` },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: logo } },
      },
    ],
    content: page(
      `<p>${link("/blog", "Blog")}</p><h1>${escapeAttribute(post.title)}</h1>` +
        (cover ? `<img src="${escapeAttribute(cover)}" alt="${escapeAttribute(post.title)}" style="max-width:100%;height:auto;border-radius:16px" />` : "") +
        post.content
          .split(/\n{2,}|<\/p>/i)
          .map((paragraph) => plainText(paragraph))
          .filter(Boolean)
          .map((paragraph) => `<p>${escapeAttribute(paragraph)}</p>`)
          .join("") +
        `<p>${link("/", "See our cakes")}</p>`,
    ),
  };
}

async function pageMeta(pathname: string, base: string): Promise<PageMeta> {
  if (pathname === "/") return homeMeta();
  if (pathname === "/blog") return blogMeta();
  if (isPrivatePath(pathname)) return { status: 200, canonicalPath: pathname, noindex: true };

  const cakeMatch = pathname.match(/^\/cake\/(\d+)$/);
  if (cakeMatch) return cakeMeta(Number(cakeMatch[1]), pathname, base);

  const postMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (postMatch) return postMeta(decodeURIComponent(postMatch[1]), pathname, base);

  // Any other address shows the shop's "page not found" screen.
  return { status: 404, canonicalPath: pathname, noindex: true };
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
  const meta: PageMeta = await pageMeta(req.path, base).catch((err): PageMeta => {
    logger.warn({ err, path: req.path }, "Page details unavailable; using the defaults");
    return { status: 200, canonicalPath: req.path };
  });
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
    html = setMeta(html, "property", "og:image", absoluteUrl(base, meta.image));
    html = setMeta(html, "name", "twitter:image", absoluteUrl(base, meta.image));
  }
  if (meta.type) html = setMeta(html, "property", "og:type", meta.type);
  if (meta.noindex) html = setMeta(html, "name", "robots", "noindex");
  if (meta.jsonLd?.length) {
    // "<" is escaped so text from the shop (names, reviews) can't end the script early.
    const scripts = meta.jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`).join("\n    ");
    html = html.replace("</head>", `    ${scripts}\n  </head>`);
  }
  if (meta.content) html = html.replace('<div id="root"></div>', `<div id="root">${meta.content}</div>`);

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

// Every cake (with its photo, for Google Images) and blog post, with when each last changed.
export async function renderSitemap(base: string) {
  const [cakes, posts] = await Promise.all([
    db
      .select({ id: cakesTable.id, name: cakesTable.name, imageUrl: cakesTable.imageUrl, updatedAt: cakesTable.updatedAt })
      .from(cakesTable)
      .where(eq(cakesTable.available, true)),
    db
      .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.published, true)),
  ]);
  const latest = (dates: Date[]) => (dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null);
  const entries: { loc: string; lastmod: Date | null; image?: string | null }[] = [
    { loc: `${base}/`, lastmod: latest(cakes.map((cake) => cake.updatedAt)) },
    ...cakes.map((cake) => ({ loc: `${base}/cake/${cake.id}`, lastmod: cake.updatedAt, image: imageUrl(base, cake.imageUrl) })),
    ...(posts.length > 0 ? [{ loc: `${base}/blog`, lastmod: latest(posts.map((post) => post.updatedAt)) }] : []),
    ...posts.map((post) => ({ loc: `${base}/blog/${encodeURIComponent(post.slug)}`, lastmod: post.updatedAt })),
  ];
  const urls = entries
    .map(
      ({ loc, lastmod, image }) =>
        `  <url><loc>${escapeAttribute(loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}${
          image ? `<image:image><image:loc>${escapeAttribute(image)}</image:loc></image:image>` : ""
        }</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
}
