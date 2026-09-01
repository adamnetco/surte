import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGridKeyboardNav } from "../useGridKeyboardNav";
import { useEnterFlow } from "../useEnterFlow";

function Grid() {
  const nav = useGridKeyboardNav<HTMLDivElement>();
  return (
    <div ref={nav.containerRef} onKeyDown={nav.onKeyDown}>
      {["a", "b", "c", "d"].map((k) => (
        <button key={k} data-kbd-item>
          {k}
        </button>
      ))}
    </div>
  );
}

function Form({ onSubmit }: { onSubmit: () => void }) {
  const flow = useEnterFlow<HTMLDivElement>({ onSubmit });
  return (
    <div data-enter-flow ref={flow.containerRef} onKeyDown={flow.onKeyDown}>
      <input aria-label="uno" />
      <input aria-label="dos" />
    </div>
  );
}

describe("useGridKeyboardNav", () => {
  it("mueve el foco con flechas", async () => {
    const user = userEvent.setup();
    render(<Grid />);
    const a = screen.getByText("a");
    a.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByText("b"));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByText("d"));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(a);
  });
});

describe("useEnterFlow", () => {
  it("Enter avanza de campo y en el último envía", async () => {
    const user = userEvent.setup();
    let submitted = 0;
    render(<Form onSubmit={() => submitted++} />);
    const uno = screen.getByLabelText("uno");
    uno.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByLabelText("dos"));
    await user.keyboard("{Enter}");
    expect(submitted).toBe(1);
  });
});
