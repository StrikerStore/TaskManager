/**
 * End-to-end check against a running API and the real database: passcode-only
 * accounts, team codes and join requests, and the task visibility rules — all
 * exercised from the outside, the way a browser would.
 */
// Through the web app by default, so the /api proxy is exercised too.
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const ORIGIN = process.env.SMOKE_ORIGIN ?? new URL(BASE).origin;
const stamp = Date.now().toString(36);

let failures = 0;
function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? ` -> ${detail}` : ""}`);
}

/** Minimal cookie jar so each actor keeps its own session. */
function makeActor(name) {
  return {
    name,
    cookies: new Map(),
    header() {
      return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
  };
}

async function call(actor, path, { method = "GET", body, teamId } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      // Browsers always send Origin; Better Auth rejects state-changing calls without it.
      origin: ORIGIN,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(teamId ? { "x-team-id": teamId } : {}),
      ...(actor.cookies.size ? { cookie: actor.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  actor.absorb(res);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const post = (actor, path, body = {}, teamId) => call(actor, path, { method: "POST", body, teamId });

const alice = makeActor("alice");
const bob = makeActor("bob");
const carol = makeActor("carol");

// --- accounts: name + username + passcode, nothing else ---------------------------
const aSignup = await post(alice, "/api/auth/sign-up/passcode", {
  name: "Alice Anand",
  username: `alice_${stamp}`,
  passcode: "482913",
});
const aliceId = aSignup.body?.user?.id;
check("alice signs up with name, username and passcode", aSignup.status === 200 && Boolean(aliceId), JSON.stringify(aSignup.body));
check("the sign-up response carries no passcode data", !/passcode/i.test(JSON.stringify(aSignup.body ?? {})));

const dupe = await post(makeActor("dupe"), "/api/auth/sign-up/passcode", {
  name: "Imposter",
  username: `ALICE_${stamp}`,
  passcode: "915273",
});
check("a taken username is refused, whatever the case", dupe.status === 409, `status=${dupe.status}`);

const weak = await post(makeActor("weak"), "/api/auth/sign-up/passcode", {
  name: "Weak",
  username: `weak_${stamp}`,
  passcode: "123456",
});
check("a guessable passcode is refused at sign-up", weak.status === 400, `status=${weak.status}`);

const bSignup = await post(bob, "/api/auth/sign-up/passcode", {
  name: "Bob Bakshi",
  username: `bob_${stamp}`,
  passcode: "730164",
});
const bobId = bSignup.body?.user?.id;
check("bob signs up", bSignup.status === 200 && Boolean(bobId), JSON.stringify(bSignup.body));

const cSignup = await post(carol, "/api/auth/sign-up/passcode", {
  name: "Carol Chawla",
  username: `carol_${stamp}`,
  passcode: "261948",
});
const carolId = cSignup.body?.user?.id;
check("carol signs up", cSignup.status === 200 && Boolean(carolId), JSON.stringify(cSignup.body));

const aliceSession = await call(alice, "/api/auth/get-session");
check(
  "the session knows alice by username",
  aliceSession.body?.user?.username === `alice_${stamp}`,
  JSON.stringify(aliceSession.body?.user),
);
check("no passcode field appears in the session", !/passcode/i.test(JSON.stringify(aliceSession.body ?? {})));

const emailSignup = await post(makeActor("email"), "/api/auth/sign-up/email", {
  name: "Old Way",
  email: `old_${stamp}@example.com`,
  password: "correct-horse-9",
});
check("email + password sign-up is switched off", emailSignup.status !== 200, `status=${emailSignup.status}`);

// --- signing in -------------------------------------------------------------------
const signIn = await post(makeActor("alice-again"), "/api/auth/sign-in/passcode", {
  username: `Alice_${stamp}`,
  passcode: "482913",
});
check("alice signs in with username + passcode (any case)", signIn.status === 200 && Boolean(signIn.body?.token), JSON.stringify(signIn.body));

const wrong = await post(makeActor("guess"), "/api/auth/sign-in/passcode", {
  username: `alice_${stamp}`,
  passcode: "000001",
});
check("a wrong passcode is refused", wrong.status === 401, `status=${wrong.status}`);

const ghost = await post(makeActor("ghost"), "/api/auth/sign-in/passcode", {
  username: `nobody_${stamp}`,
  passcode: "482913",
});
check(
  "an unknown username gets the identical answer",
  ghost.status === 401 && ghost.body?.message === wrong.body?.message,
  `${ghost.status} "${ghost.body?.message}" vs "${wrong.body?.message}"`,
);

const retry = await post(makeActor("retry"), "/api/auth/sign-in/passcode", {
  username: `alice_${stamp}`,
  passcode: "482913",
});
check("no lockout: the right passcode works straight after a wrong one", retry.status === 200, `status=${retry.status}`);

// --- changing a passcode --------------------------------------------------------------
const badChange = await post(carol, "/api/auth/passcode/change", {
  currentPasscode: "000000",
  newPasscode: "594826",
});
check("changing a passcode needs the current one", badChange.status === 401, `status=${badChange.status}`);

const change = await post(carol, "/api/auth/passcode/change", {
  currentPasscode: "261948",
  newPasscode: "594826",
});
check("carol changes her passcode", change.status === 200, JSON.stringify(change.body));

const oldPin = await post(makeActor("carol-old"), "/api/auth/sign-in/passcode", {
  username: `carol_${stamp}`,
  passcode: "261948",
});
check("the old passcode stops working", oldPin.status === 401, `status=${oldPin.status}`);

const tamper = await post(carol, "/api/auth/update-user", { passcodeHash: "tampered" });
const afterTamper = await post(makeActor("carol-new"), "/api/auth/sign-in/passcode", {
  username: `carol_${stamp}`,
  passcode: "594826",
});
check(
  "the new passcode works, and update-user cannot overwrite it",
  afterTamper.status === 200,
  `update-user=${tamper.status} sign-in=${afterTamper.status}`,
);

// --- teams: create, code, join requests -------------------------------------------
const org = await post(alice, "/api/auth/organization/create", {
  name: "Test Team",
  slug: `test-team-${stamp}`,
});
const teamId = org.body?.id;
check("alice creates a team", org.status === 200 && Boolean(teamId), JSON.stringify(org.body));

const codeRes = await call(alice, "/api/teams/code", { teamId });
const code = codeRes.body?.code ?? "";
check("the owner gets an 8-character team code", codeRes.status === 200 && /^[A-Z0-9]{8}$/.test(code), JSON.stringify(codeRes.body));

const sameCode = await call(alice, "/api/teams/code", { teamId });
check("the code stays the same until rotated", sameCode.body?.code === code);

const bobPeek = await call(bob, "/api/teams/code", { teamId });
check("a non-member cannot read the team code", bobPeek.status === 403, `status=${bobPeek.status}`);

const badCode = await post(bob, "/api/teams/join", { code: "ZZZZ-ZZZZ" });
check("an unknown code is refused", badCode.status === 404, `status=${badCode.status}`);

const join = await post(bob, "/api/teams/join", { code: `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase() });
const bobRequestId = join.body?.request?.id;
check(
  "bob asks to join (lower case, with a dash)",
  join.status === 201 && join.body?.request?.status === "pending",
  JSON.stringify(join.body),
);
check("the request names the team", join.body?.request?.teamName === "Test Team");

const joinAgain = await post(bob, "/api/teams/join", { code });
check(
  "asking twice keeps a single request",
  joinAgain.status === 200 && joinAgain.body?.request?.id === bobRequestId,
  JSON.stringify(joinAgain.body),
);

const bobEarly = await call(bob, "/api/tasks", { teamId });
check("a pending request gives no access to the team", bobEarly.status === 403, `status=${bobEarly.status}`);

const bobMine = await call(bob, "/api/teams/my-requests");
check(
  "bob can see his request is pending",
  (bobMine.body?.requests ?? []).some((r) => r.id === bobRequestId && r.status === "pending"),
  JSON.stringify(bobMine.body),
);

const carolJoin = await post(carol, "/api/teams/join", { code });
const carolRequestId = carolJoin.body?.request?.id;
check("carol asks to join too", carolJoin.status === 201, JSON.stringify(carolJoin.body));

const bobQueue = await call(bob, "/api/teams/requests", { teamId });
check("a non-member cannot see the request queue", bobQueue.status === 403, `status=${bobQueue.status}`);

const queue = await call(alice, "/api/teams/requests", { teamId });
const queued = (queue.body?.requests ?? []).map((r) => r.user?.username);
check(
  "the owner sees both requests by username",
  queued.includes(`bob_${stamp}`) && queued.includes(`carol_${stamp}`),
  JSON.stringify(queued),
);

const accept = await post(alice, `/api/teams/requests/${bobRequestId}/accept`, {}, teamId);
check("the owner accepts bob", accept.status === 200, JSON.stringify(accept.body));

const reject = await post(alice, `/api/teams/requests/${carolRequestId}/reject`, {}, teamId);
check("the owner declines carol", reject.status === 200, JSON.stringify(reject.body));

const reDecide = await post(alice, `/api/teams/requests/${carolRequestId}/accept`, {}, teamId);
check("a decided request cannot be decided again", reDecide.status === 409, `status=${reDecide.status}`);

const bobIn = await call(bob, "/api/tasks", { teamId });
check("accepted: bob can use the team", bobIn.status === 200, `status=${bobIn.status}`);

const carolOut = await call(carol, "/api/tasks", { teamId });
check("declined: carol still cannot", carolOut.status === 403, `status=${carolOut.status}`);

const carolMine = await call(carol, "/api/teams/my-requests");
check(
  "carol can see she was declined",
  (carolMine.body?.requests ?? []).some((r) => r.id === carolRequestId && r.status === "rejected"),
  JSON.stringify(carolMine.body),
);

const bobDecides = await post(bob, `/api/teams/requests/${carolRequestId}/reject`, {}, teamId);
check("a regular member cannot decide requests", bobDecides.status === 403, `status=${bobDecides.status}`);

const members = await call(bob, "/api/teams/members", { teamId });
const usernames = (members.body?.members ?? []).map((m) => m.user?.username);
check(
  "members are listed by username: alice and bob, not carol",
  usernames.includes(`alice_${stamp}`) && usernames.includes(`bob_${stamp}`) && !usernames.includes(`carol_${stamp}`),
  JSON.stringify(usernames),
);
check("the member list exposes no email address", !JSON.stringify(members.body ?? {}).includes("@"));

const rotated = await post(alice, "/api/teams/code/rotate", {}, teamId);
check(
  "the owner can issue a new code",
  rotated.status === 200 && /^[A-Z0-9]{8}$/.test(rotated.body?.code ?? "") && rotated.body.code !== code,
  JSON.stringify(rotated.body),
);

const staleCode = await post(carol, "/api/teams/join", { code });
check("the old code stops working", staleCode.status === 404, `status=${staleCode.status}`);

// --- tasks: the visibility rules still hold ---------------------------------------
const project = await post(alice, "/api/projects", { name: "Billing", color: "#c8410b" }, teamId);
const projectId = project.body?.project?.id;
check("alice creates a project", project.status === 201 && Boolean(projectId), JSON.stringify(project.body));

const teamTask = await post(alice, "/api/tasks", { title: "Ship the invoice fix", projectId, assigneeId: bobId }, teamId);
check("alice assigns a team task to bob", teamTask.status === 201, JSON.stringify(teamTask.body));

const personal = await post(alice, "/api/tasks", { title: "Book dentist", isPersonal: true }, teamId);
check("alice creates a personal task", personal.status === 201, JSON.stringify(personal.body));

const bobTasks = await call(bob, "/api/tasks", { teamId });
const bobTitles = (bobTasks.body?.tasks ?? []).map((t) => t.title);
check("bob sees the team task", bobTitles.includes("Ship the invoice fix"), JSON.stringify(bobTitles));
check("bob does NOT see alice's personal task", !bobTitles.includes("Book dentist"), JSON.stringify(bobTitles));

const steal = await call(bob, `/api/tasks/${personal.body?.task?.id}`, {
  method: "PATCH",
  teamId,
  body: { title: "hijacked" },
});
check("bob cannot edit it by id", steal.status === 404, `status=${steal.status}`);

const assignCarol = await post(alice, "/api/tasks", { title: "Not allowed", assigneeId: carolId }, teamId);
check("someone outside the team cannot be assigned a task", assignCarol.status === 400, `status=${assignCarol.status}`);

const rule = await post(
  alice,
  "/api/recurring",
  {
    title: "Weekly status report",
    projectId,
    assigneeId: bobId,
    frequency: "weekly",
    weekdays: [1, 4],
    triggerTime: "09:00",
    dueOffsetDays: 2,
  },
  teamId,
);
check("alice creates a twice-a-week rule for bob", rule.status === 201, JSON.stringify(rule.body));

const ran = await post(alice, `/api/recurring/${rule.body?.rule?.id}/run-now`, {}, teamId);
check("run-now creates the task for bob", ran.status === 201 && ran.body?.task?.assigneeId === bobId, JSON.stringify(ran.body));

// --- removing members ----------------------------------------------------------------
const bobRemovesAlice = await call(bob, `/api/teams/members/${aliceId}`, { method: "DELETE", teamId });
check("a regular member cannot remove anyone", bobRemovesAlice.status === 403, `status=${bobRemovesAlice.status}`);

const aliceRemovesSelf = await call(alice, `/api/teams/members/${aliceId}`, { method: "DELETE", teamId });
check("the owner cannot remove themselves", aliceRemovesSelf.status === 400, `status=${aliceRemovesSelf.status}`);

const removeBob = await call(alice, `/api/teams/members/${bobId}`, { method: "DELETE", teamId });
check("the owner removes bob", removeBob.status === 204, `status=${removeBob.status}`);

const bobAfter = await call(bob, "/api/tasks", { teamId });
check("once removed, bob loses access", bobAfter.status === 403, `status=${bobAfter.status}`);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
