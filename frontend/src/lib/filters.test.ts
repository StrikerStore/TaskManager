import { describe, expect, it } from "vitest";
import { filtersFromParams, paramsFromFilters } from "./filters";
import { DEFAULT_FILTERS, type TaskFilters } from "./types";

describe("filter URL round trip", () => {
  it("writes nothing for the default view", () => {
    expect(paramsFromFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("reads defaults from an empty query string", () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("survives a round trip with every filter set", () => {
    const filters: TaskFilters = {
      q: "invoice",
      projectIds: ["p1", "p2", "none"],
      assigneeIds: ["u1", "unassigned"],
      status: ["todo", "in_progress"],
      priority: ["high", "urgent"],
      due: "overdue",
      scope: "mine",
      showCompleted: true,
      sort: "due",
      groupBy: "project",
    };

    expect(filtersFromParams(new URLSearchParams(paramsFromFilters(filters)))).toEqual(filters);
  });

  it("ignores junk values instead of trusting them", () => {
    const params = new URLSearchParams(
      "scope=hacker&due=whenever&sort=magic&groupBy=chaos&showCompleted=maybe",
    );
    const filters = filtersFromParams(params);

    expect(filters.scope).toBe("all");
    expect(filters.due).toBeNull();
    expect(filters.sort).toBe("created");
    expect(filters.groupBy).toBe("none");
    expect(filters.showCompleted).toBe(false);
  });

  it("parses a link from the sidebar project list", () => {
    const filters = filtersFromParams(new URLSearchParams("projectIds=abc123"));
    expect(filters.projectIds).toEqual(["abc123"]);
    expect(filters.scope).toBe("all");
  });

  it("parses the personal view link", () => {
    expect(filtersFromParams(new URLSearchParams("scope=personal")).scope).toBe("personal");
  });

  it("drops empty entries from a trailing comma", () => {
    expect(filtersFromParams(new URLSearchParams("projectIds=a,,b,")).projectIds).toEqual(["a", "b"]);
  });
});
