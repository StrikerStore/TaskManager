import { and, eq, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { recurringTask, task, type RecurringTask } from "../db/schema.js";
import { newId } from "../lib/ids.js";
import { computeNextRun, parseDays } from "./recurrence.js";

const TICK_MS = 60_000;

/** Creates one task from a rule and moves the rule to its next occurrence. */
export async function runRecurringRule(rule: RecurringTask, now: Date = new Date()) {
  const dueDate =
    rule.dueOffsetDays > 0
      ? new Date(now.getTime() + rule.dueOffsetDays * 86_400_000)
      : null;

  const row = {
    id: newId(),
    organizationId: rule.organizationId,
    title: rule.title,
    description: rule.description,
    projectId: rule.isPersonal ? null : rule.projectId,
    status: "todo" as const,
    priority: rule.priority,
    assigneeId: rule.assigneeId,
    createdById: rule.createdById,
    dueDate,
    isPersonal: rule.isPersonal,
    completedAt: null,
  };

  await db.insert(task).values(row);

  await db
    .update(recurringTask)
    .set({
      lastRunAt: now,
      nextRunAt: computeNextRun(
        {
          frequency: rule.frequency,
          weekdays: parseDays(rule.weekdays),
          monthDays: parseDays(rule.monthDays),
          triggerTime: rule.triggerTime,
          // Biweekly parity follows the rule's creation week, so a run missed
          // while the server was down does not shift the cadence for good.
          anchor: rule.createdAt,
        },
        now,
      ),
    })
    .where(eq(recurringTask.id, rule.id));

  return row;
}

/**
 * Creates any task whose trigger time has arrived.
 *
 * If the server was down across several occurrences, each rule still produces a
 * single task rather than one per missed period — catching up on a fortnight of
 * daily reminders would just be noise.
 */
export async function runDueRecurringTasks(now: Date = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(recurringTask)
    .where(and(eq(recurringTask.active, true), lte(recurringTask.nextRunAt, now)));

  for (const rule of due) {
    try {
      await runRecurringRule(rule, now);
    } catch (error) {
      console.error(`[scheduler] rule ${rule.id} failed:`, error);
    }
  }
  return due.length;
}

/** Starts the once-a-minute loop. Returns a stop function. */
export function startScheduler(): () => void {
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap two passes
    running = true;
    try {
      const created = await runDueRecurringTasks();
      if (created > 0) console.log(`[scheduler] created ${created} task(s)`);
    } catch (error) {
      console.error("[scheduler] tick failed:", error);
    } finally {
      running = false;
    }
  };

  void tick(); // catch up immediately on boot
  const handle = setInterval(() => void tick(), TICK_MS);
  return () => clearInterval(handle);
}
