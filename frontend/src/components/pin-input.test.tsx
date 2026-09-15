// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PinInput } from "./pin-input";

afterEach(cleanup);

/** PinInput is controlled, so tests drive it through real state, as the pages do. */
function Harness({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <PinInput value={value} onChange={setValue} onComplete={onComplete} ariaLabel="Passcode" />
      <output data-testid="value">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByLabelText(/^Passcode digit/);
const valueText = () => screen.getByTestId("value").textContent;

describe("PinInput", () => {
  it("jumps to the next box after each digit", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.keyboard("4");
    expect(document.activeElement).toBe(boxes()[1]);

    await user.keyboard("8");
    expect(document.activeElement).toBe(boxes()[2]);

    await user.keyboard("2");
    expect(document.activeElement).toBe(boxes()[3]);
    expect(valueText()).toBe("482");
  });

  it("takes all six digits typed in one go and reports completion", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);

    await user.click(boxes()[0]!);
    await user.keyboard("482913");

    expect(valueText()).toBe("482913");
    expect(onComplete).toHaveBeenCalledWith("482913");
  });

  it("steps back a box on Backspace", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.keyboard("482");
    await user.keyboard("{Backspace}");

    expect(valueText()).toBe("48");
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("fills every box from a paste", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.paste("482913");

    expect(valueText()).toBe("482913");
  });

  it("ignores anything that isn't a digit", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.keyboard("a4b");

    expect(valueText()).toBe("4");
    expect(document.activeElement).toBe(boxes()[1]);
  });
});
