import { logger } from "./logger";

// Work that mustn't hold up the reply, like emails: customers and the owner aren't kept waiting on the email
// service, and a failure is logged instead of failing the order or payment it's about.
export function inBackground(what: string, task: () => Promise<unknown>) {
  void task().catch((err) => logger.error({ err }, `${what} failed`));
}
