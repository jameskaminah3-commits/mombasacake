import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { renderRobotsTxt, renderSitemap, renderStorefrontPage, siteUrl } from "./lib/seo";

const app: Express = express();
const bundleDir = path.dirname(fileURLToPath(import.meta.url));
const storefrontCandidates = [
  path.resolve(bundleDir, "../../cakeshop/dist/public"),
  path.resolve(process.cwd(), "artifacts/cakeshop/dist/public"),
  path.resolve(process.cwd(), "../cakeshop/dist/public"),
];
const storefrontDist =
  storefrontCandidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ??
  storefrontCandidates[0];

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Gzip text responses (the storefront bundle and API JSON); images are left as they are.
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// The old separate menu page is now the shop's home page.
app.get("/menu", (req, res) => {
  res.redirect(301, `/${req.originalUrl.slice(req.path.length)}`);
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(renderRobotsTxt(siteUrl(req)));
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(await renderSitemap(siteUrl(req)));
  } catch (err) {
    logger.error({ err }, "Sitemap failed");
    res.status(500).type("text/plain").send("Sitemap unavailable");
  }
});

app.use(
  express.static(storefrontDist, {
    // Pages (including "/") go through renderStorefrontPage below, which fills in each page's title and address.
    index: false,
    setHeaders(res, filePath) {
      // Built JS/CSS get a new hashed filename on every deploy, so browsers can keep them for a year.
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

app.use(async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) {
    next();
    return;
  }

  try {
    const page = await renderStorefrontPage(req, path.join(storefrontDist, "index.html"));
    // Pages are small; always check for a newer version so deploys reach customers straight away.
    res.status(page.status).type("html").set("Cache-Control", "no-cache").send(page.html);
  } catch (err) {
    next(err);
  }
});

export default app;
