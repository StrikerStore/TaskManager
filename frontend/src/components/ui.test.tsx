// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Sheet, Textarea } from "./ui";

afterEach(cleanup);

/**
 * Mirrors how the task panel uses Sheet: state above it, and an `onClose`
 * closure rebuilt on every render.
 */
function Harness() {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(true);

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Task">
      <label htmlFor="notes">Notes</label>
      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Sheet>
  );
}

describe("Sheet", () => {
  it("keeps focus in a field while typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    await user.click(notes);
    await user.keyboard("Ship it");

    expect(notes.value).toBe("Ship it");
    expect(document.activeElement).toBe(notes);
  });

  it("still closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
