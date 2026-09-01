import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("mueve el foco con flechas", () => {
    render(<Grid />);
    const a = screen.getByText("a");
    a.focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByText("b"));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByText("d"));
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(a);
  });
});

describe("useEnterFlow", () => {
  it("Enter avanza de campo y en el último envía", () => {
    let submitted = 0;
    render(<Form onSubmit={() => submitted++} />);
    const uno = screen.getByLabelText("uno");
    uno.focus();
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(document.activeElement).toBe(screen.getByLabelText("dos"));
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(submitted).toBe(1);
  });
});
