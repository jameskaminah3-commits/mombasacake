import app from "./app";
import { logger } from "./lib/logger";
import { ensureOrdersSchema } from "./lib/ensure-orders-schema";

const rawPort =
  process.env["PORT"] ??
  (process.env["NODE_ENV"] === "production" ? undefined : "3001");

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureOrdersSchema().catch((err) => {
  logger.error({ err }, "ensureOrdersSchema failed at startup");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
