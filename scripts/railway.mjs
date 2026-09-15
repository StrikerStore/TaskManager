#!/usr/bin/env node
/**
 * One build and start entry point for Railway.
 *
 * Railpack reads the build and start commands from the root package.json, and
 * both Railway services deploy this same repository. Each service therefore
 * says which app it is with one variable: TASKBOARD_APP=backend or TASKBOARD_APP=web.
 *
 *   node scripts/railway.mjs build
 *   node scripts/railway.mjs start
 */
import { spawn, spawnSync } from "node:child_process";

/** Steps run in order; the last one of "start" is the long-running server. */
const APPS = {
  backend: {
    build: ["pnpm --filter backend build"],
    // Migrate first, so a fresh or updated database is ready before the API listens.
    start: ["pnpm --filter backend db:migrate", "pnpm --filter backend start"],
  },
  web: {
    build: ["pnpm --filter frontend build"],
    start: ["pnpm --filter frontend start"],
  },
};

function fail(message) {
  console.error(`\n[taskboard] ${message}\n`);
  process.exit(1);
}

const step = process.argv[2];
if (step !== "build" && step !== "start") {
  fail(`Unknown step "${step ?? ""}". Use "build" or "start".`);
}

const rawApp = process.env.TASKBOARD_APP?.trim() ?? "";
const app = rawApp.toLowerCase();

let commands;
if (APPS[app]) {
  commands = APPS[app][step];
} else if (!app && step === "build") {
  // Local convenience: with no app chosen, `pnpm build` builds both.
  commands = [...APPS.backend.build, ...APPS.web.build];
} else if (!app) {
  fail('TASKBOARD_APP is not set. On each Railway service set it to "backend" or "web".');
} else {
  fail(`TASKBOARD_APP="${rawApp}" is not recognised. Set it to "backend" or "web".`);
}

const label = app || "backend + web";
const setup = commands.slice(0, -1);
const final = commands[commands.length - 1];

// shell: true so `pnpm` resolves the same way on Linux (Railway) and Windows (local).
for (const command of setup) {
  console.log(`[taskboard] ${step} ${label}: ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) fail(`"${command}" failed with exit code ${result.status ?? "unknown"}.`);
}

console.log(`[taskboard] ${step} ${label}: ${final}`);
const child = spawn(final, { stdio: "inherit", shell: true });

// Pass Railway's stop signal on, so the server gets the chance to shut down cleanly.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
