import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env, isProd } from "./env.js";
import { auth } from "./lib/auth.js";
import { HttpError } from "./lib/http.js";
import { startScheduler } from "./lib/scheduler.js";
import { projectsRouter } from "./routes/projects.js";
import { recurringRouter } from "./routes/recurring.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

// The frontend is a different origin, so cookies need an explicit allow-list.
app.use(
  cors({
    origin: [env.APP_URL],
    credentials: true,
    allowedHeaders: ["Content-Type", "x-team-id"],
  }),
);

// Better Auth mounts its own routes and needs the raw body, so it goes before express.json().
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/teams", teamsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: isProd ? "Something went wrong" : String(err) });
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (allowing ${env.APP_URL})`);
  const stopScheduler = startScheduler();
  console.log("Recurring-task scheduler running (every 60s)");

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopScheduler();
      process.exit(0);
    });
  }
});
