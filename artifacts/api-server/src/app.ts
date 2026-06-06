import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(express.static(storefrontDist));

app.use((req, res, next) => {
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

  res.sendFile(path.join(storefrontDist, "index.html"));
});

export default app;
