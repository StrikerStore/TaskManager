import { describe, expect, it } from "vitest";
import {
  computeNextRun,
  describeRecurrence,
  parseDays,
  parseTriggerTime,
  serializeDays,
} from "./recurrence.js";

/** Wednesday 2026-09-16, 10:00 local. */
const WED_10AM = new Date(2026, 8, 16, 10, 0, 0, 0);

describe("parseTriggerTime", () => {
  it("reads a normal time", () => {
    expect(parseTriggerTime("09:30")).toEqual({ hours: 9, minutes: 30 });
    expect(parseTriggerTime("23:59")).toEqual({ hours: 23, minutes: 59 });
  });

  it("falls back to 09:00 on nonsense", () => {
    expect(parseTriggerTime("25:00")).toEqual({ hours: 9, minutes: 0 });
    expect(parseTriggerTime("banana")).toEqual({ hours: 9, minutes: 0 });
    expect(parseTriggerTime("")).toEqual({ hours: 9, minutes: 0 });
  });
});

describe("computeNextRun — daily", () => {
  it("fires later today when the time is still ahead", () => {
    const next = computeNextRun({ frequency: "daily", triggerTime: "18:00" }, WED_10AM);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(18);
  });

  it("rolls to tomorrow when the time has passed", () => {
    const next = computeNextRun({ frequency: "daily", triggerTime: "08:00" }, WED_10AM);
    expect(next.getDate()).toBe(17);
    expect(next.getHours()).toBe(8);
  });

  it("does not fire twice at the exact trigger moment", () => {
    const exactly9 = new Date(2026, 8, 16, 9, 0, 0, 0);
    const next = computeNextRun({ frequency: "daily", triggerTime: "09:00" }, exactly9);
    expect(next.getDate()).toBe(17);
  });
});

describe("computeNextRun — weekly", () => {
  it("finds the next Friday", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [5], triggerTime: "09:00" },
      WED_10AM,
    );
    expect(next.getDay()).toBe(5);
    expect(next.getDate()).toBe(18);
  });

  it("skips a full week when today matches but the time has passed", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [3], triggerTime: "08:00" },
      WED_10AM,
    );
    expect(next.getDay()).toBe(3);
    expect(next.getDate()).toBe(23);
  });

  it("stays today when today matches and the time is ahead", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [3], triggerTime: "16:00" },
      WED_10AM,
    );
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(16);
  });
});

describe("computeNextRun — biweekly", () => {
  it("keeps every-second-week alignment with its anchor", () => {
    const anchor = new Date(2026, 8, 9, 9, 0, 0, 0); // Wednesday, one week before
    const next = computeNextRun(
      { frequency: "biweekly", weekdays: [3], triggerTime: "09:00", anchor },
      WED_10AM,
    );
    // 16 Sept is only 7 days after the anchor, so it must skip to the 23rd.
    expect(next.getDate()).toBe(23);
    expect(next.getDay()).toBe(3);
  });

  it("lands 14 days after the anchor when that is the next slot", () => {
    const anchor = new Date(2026, 8, 16, 9, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "biweekly", weekdays: [3], triggerTime: "09:00", anchor },
      WED_10AM,
    );
    expect(next.getDate()).toBe(30);
  });
});

describe("computeNextRun — monthly", () => {
  it("fires later this month", () => {
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [25], triggerTime: "09:00" },
      WED_10AM,
    );
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(25);
  });

  it("rolls into next month once the day has passed", () => {
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [3], triggerTime: "09:00" },
      WED_10AM,
    );
    expect(next.getMonth()).toBe(9);
    expect(next.getDate()).toBe(3);
  });

  it("clamps the 31st to the last day of a short month", () => {
    const sep20 = new Date(2026, 8, 20, 12, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [31], triggerTime: "09:00" },
      sep20,
    );
    expect(next.getMonth()).toBe(8); // September has 30 days
    expect(next.getDate()).toBe(30);
  });

  it("clamps to 28 in a non-leap February", () => {
    const feb1 = new Date(2027, 1, 1, 12, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [31], triggerTime: "09:00" },
      feb1,
    );
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("crosses the year boundary", () => {
    const dec20 = new Date(2026, 11, 20, 12, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [5], triggerTime: "09:00" },
      dec20,
    );
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
  });
});

describe("describeRecurrence", () => {
  it("describes each frequency in plain words", () => {
    expect(describeRecurrence({ frequency: "daily", triggerTime: "09:00" })).toBe(
      "Every day at 09:00",
    );
    expect(describeRecurrence({ frequency: "weekly", weekdays: [2], triggerTime: "14:30" })).toBe(
      "Every Tuesday at 14:30",
    );
    expect(describeRecurrence({ frequency: "biweekly", weekdays: [5], triggerTime: "09:00" })).toBe(
      "Every other Friday at 09:00",
    );
    expect(describeRecurrence({ frequency: "monthly", monthDays: [1], triggerTime: "09:00" })).toBe(
      "Monthly on the 1st at 09:00",
    );
    expect(describeRecurrence({ frequency: "monthly", monthDays: [22], triggerTime: "09:00" })).toBe(
      "Monthly on the 22nd at 09:00",
    );
    expect(describeRecurrence({ frequency: "monthly", monthDays: [11], triggerTime: "09:00" })).toBe(
      "Monthly on the 11th at 09:00",
    );
  });
});

describe("day-set storage", () => {
  it("round-trips a sorted CSV", () => {
    expect(serializeDays([4, 1])).toBe("1,4");
    expect(parseDays("1,4")).toEqual([1, 4]);
  });

  it("drops duplicates and treats empty as null", () => {
    expect(serializeDays([3, 3, 1])).toBe("1,3");
    expect(serializeDays([])).toBeNull();
    expect(serializeDays(null)).toBeNull();
    expect(parseDays(null)).toEqual([]);
    expect(parseDays("")).toEqual([]);
  });
});

describe("computeNextRun — several days a week", () => {
  it("picks the soonest of Mon and Thu", () => {
    // Wednesday: Thursday is tomorrow, Monday is five days out.
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [1, 4], triggerTime: "09:00" },
      WED_10AM,
    );
    expect(next.getDay()).toBe(4);
    expect(next.getDate()).toBe(17);
  });

  it("moves to the other day once the first has passed", () => {
    const thu10 = new Date(2026, 8, 17, 10, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [1, 4], triggerTime: "09:00" },
      thu10,
    );
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(21);
  });

  it("handles a Mon/Wed/Fri rule", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [1, 3, 5], triggerTime: "16:00" },
      WED_10AM,
    );
    expect(next.getDate()).toBe(16); // today at 16:00 is still ahead
    expect(next.getHours()).toBe(16);
  });

  it("treats all seven days like a daily rule", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6], triggerTime: "08:00" },
      WED_10AM,
    );
    expect(next.getDate()).toBe(17);
  });

  it("falls back to today's weekday when the set is empty", () => {
    const next = computeNextRun(
      { frequency: "weekly", weekdays: [], triggerTime: "08:00" },
      WED_10AM,
    );
    expect(next.getDay()).toBe(WED_10AM.getDay());
  });
});

describe("computeNextRun — biweekly with several days", () => {
  it("fires on both days inside an 'on' week", () => {
    const anchor = new Date(2026, 8, 14, 9, 0, 0, 0); // Monday of this same week
    const next = computeNextRun(
      { frequency: "biweekly", weekdays: [1, 4], triggerTime: "09:00", anchor },
      WED_10AM,
    );
    // Thursday of the anchor week, not pushed out by the Mon/Thu day gap.
    expect(next.getDate()).toBe(17);
    expect(next.getDay()).toBe(4);
  });

  it("skips the whole 'off' week", () => {
    const anchor = new Date(2026, 8, 7, 9, 0, 0, 0); // Monday, the week before
    const next = computeNextRun(
      { frequency: "biweekly", weekdays: [1, 4], triggerTime: "09:00", anchor },
      WED_10AM,
    );
    // This week is odd against the anchor, so both days wait a week.
    expect(next.getDate()).toBe(21);
    expect(next.getDay()).toBe(1);
  });
});

describe("computeNextRun — several days a month", () => {
  it("picks the soonest of the 1st and 15th", () => {
    const third = new Date(2026, 8, 3, 12, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [1, 15], triggerTime: "09:00" },
      third,
    );
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(15);
  });

  it("rolls to the 1st of next month once both have passed", () => {
    const twentieth = new Date(2026, 8, 20, 12, 0, 0, 0);
    const next = computeNextRun(
      { frequency: "monthly", monthDays: [1, 15], triggerTime: "09:00" },
      twentieth,
    );
    expect(next.getMonth()).toBe(9);
    expect(next.getDate()).toBe(1);
  });

  it("fires once when 30 and 31 both clamp to the same February day", () => {
    const feb1 = new Date(2027, 1, 1, 12, 0, 0, 0);
    const first = computeNextRun(
      { frequency: "monthly", monthDays: [30, 31], triggerTime: "09:00" },
      feb1,
    );
    expect(first.getMonth()).toBe(1);
    expect(first.getDate()).toBe(28);

    // The next run must leave February rather than repeating the 28th.
    const second = computeNextRun(
      { frequency: "monthly", monthDays: [30, 31], triggerTime: "09:00" },
      first,
    );
    expect(second.getMonth()).toBe(2);
    expect(second.getDate()).toBe(30);
  });
});

describe("describeRecurrence — several days", () => {
  it("counts the days in plain words", () => {
    expect(describeRecurrence({ frequency: "weekly", weekdays: [1, 4], triggerTime: "09:00" })).toBe(
      "Twice a week · Mon, Thu at 09:00",
    );
    expect(
      describeRecurrence({ frequency: "weekly", weekdays: [1, 3, 5], triggerTime: "09:00" }),
    ).toBe("3× a week · Mon, Wed, Fri at 09:00");
  });

  it("names the common sets instead of listing them", () => {
    expect(
      describeRecurrence({ frequency: "weekly", weekdays: [1, 2, 3, 4, 5], triggerTime: "09:00" }),
    ).toBe("Every weekday at 09:00");
    expect(describeRecurrence({ frequency: "weekly", weekdays: [0, 6], triggerTime: "09:00" })).toBe(
      "Every weekend at 09:00",
    );
    expect(
      describeRecurrence({
        frequency: "weekly",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        triggerTime: "09:00",
      }),
    ).toBe("Every day at 09:00");
  });

  it("describes multi-day biweekly and monthly rules", () => {
    expect(
      describeRecurrence({ frequency: "biweekly", weekdays: [1, 4], triggerTime: "09:00" }),
    ).toBe("Every other week on Mon, Thu at 09:00");
    expect(
      describeRecurrence({ frequency: "monthly", monthDays: [1, 15], triggerTime: "09:00" }),
    ).toBe("Twice a month · 1st, 15th at 09:00");
  });
});
