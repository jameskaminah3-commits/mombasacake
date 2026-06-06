import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env.local");
const env = normalizeEnvironment(process.env);

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && env[key] === undefined) {
      env[key] = value;
    }
  }
}

env.NODE_ENV ??= "development";
env.PORT ??= "3001";
env.API_PORT ??= env.PORT;
env.WEB_PORT ??= "5173";
env.BASE_PATH ??= "/";

if (!env.DATABASE_URL || env.DATABASE_URL.includes("YOUR-PASSWORD")) {
  console.warn(
    "DATABASE_URL is not configured. The API needs your Supabase Postgres connection string.",
  );
  console.warn("Starting the frontend only at http://localhost:5173.");
  run(["pnpm", "--filter", "@workspace/cakeshop", "run", "dev"], env);
} else {
  run(["pnpm", "--filter", "@workspace/api-server", "run", "dev"], env);
  run(["pnpm", "--filter", "@workspace/cakeshop", "run", "dev"], env);
}

function run(args, childEnv) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "corepack";
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", ["corepack", ...args].map(quoteCmdArg).join(" ")]
    : args;
  const child = spawn(command, commandArgs, {
    cwd: root,
    env: childEnv,
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
}

function quoteCmdArg(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function normalizeEnvironment(source) {
  const normalized = {};
  const seen = new Map();

  for (const [key, value] of Object.entries(source)) {
    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      const existingKey = seen.get(lower);
      if (key === "Path" || (existingKey !== "Path" && key === key.toUpperCase())) {
        delete normalized[existingKey];
        normalized[key] = value;
        seen.set(lower, key);
      }
      continue;
    }

    normalized[key] = value;
    seen.set(lower, key);
  }

  return normalized;
}
