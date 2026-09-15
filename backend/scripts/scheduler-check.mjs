/**
 * Proves the background scheduler fires on its own: schedules a rule about a
 * minute out, then waits for the task to appear without anyone touching the app.
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const stamp = Date.now().toString(36);
const cookies = new Map();

async function call(path, { method = "GET", body, teamId } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: new URL(BASE).origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(teamId ? { "x-team-id": teamId } : {}),
      ...(cookies.size
        ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const signup = await call("/api/auth/sign-up/passcode", {
  method: "POST",
  body: { name: "Sched Tester", username: `sched_${stamp}`, passcode: "482913" },
});
const userId = signup.body?.user?.id;
if (!userId) {
  console.log("FAIL  could not sign up:", JSON.stringify(signup.body));
  process.exit(1);
}

const org = await call("/api/auth/organization/create", {
  method: "POST",
  body: { name: "Sched Team", slug: `sched-${stamp}` },
});
const teamId = org.body?.id;

// Fire at the top of the next minute, plus a little slack.
const fireAt = new Date(Date.now() + 65_000);
const triggerTime = `${String(fireAt.getHours()).padStart(2, "0")}:${String(
  fireAt.getMinutes(),
).padStart(2, "0")}`;

const rule = await call("/api/recurring", {
  method: "POST",
  teamId,
  body: {
    title: `Scheduled at ${triggerTime}`,
    assigneeId: userId,
    frequency: "daily",
    triggerTime,
    dueOffsetDays: 1,
  },
});

console.log(`rule set for ${triggerTime} (next run ${rule.body?.rule?.nextRunAt})`);
console.log("waiting for the scheduler to fire on its own…");

const deadline = Date.now() + 150_000;
let found = null;

while (Date.now() < deadline && !found) {
  await new Promise((r) => setTimeout(r, 10_000));
  const list = await call("/api/tasks", { teamId });
  found = (list.body?.tasks ?? []).find((t) => t.title === `Scheduled at ${triggerTime}`);
  process.stdout.write(".");
}

console.log();
if (found) {
  const after = await call("/api/recurring", { teamId });
  const updated = (after.body?.rules ?? [])[0];
  console.log(`PASS  scheduler created the task by itself (id ${found.id})`);
  console.log(`PASS  task due date set: ${found.dueDate}`);
  console.log(`PASS  rule rolled forward to: ${updated?.nextRunAt}`);
  console.log(`PASS  rule recorded lastRunAt: ${updated?.lastRunAt}`);
  process.exit(0);
} else {
  console.log("FAIL  the scheduler did not create the task within 150s");
  process.exit(1);
}
