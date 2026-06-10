import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Printer } from "lucide-react";
import { StatusPill } from "../StatusPill";

function renderPill(props: Partial<React.ComponentProps<typeof StatusPill>> = {}) {
  return render(
    <MemoryRouter>
      <StatusPill
        icon={Printer}
        label="Impresora"
        status="ok"
        hint="Agente conectado"
        description="Agente operativo"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("StatusPill a11y", () => {
  it("expone aria-label con label + estado + hint", () => {
    renderPill({ status: "off", hint: "Agente no detectado" });
    const btn = screen.getByRole("button", { name: /impresora/i });
    expect(btn).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/impresora.*fuera de servicio.*agente no detectado/i),
    );
  });

  it("el popover usa role=dialog y describe el estado en aria-live", async () => {
    renderPill({ status: "warn", description: "Reintentando…" });
    fireEvent.click(screen.getByRole("button", { name: /impresora/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    const desc = within(dialog).getByText("Reintentando…");
    expect(desc).toHaveAttribute("aria-live", "polite");
  });

  it("renderiza acción Reintentar accesible por teclado y dispara el handler", async () => {
    const onRetry = vi.fn();
    renderPill({ onRetry });
    fireEvent.click(screen.getByRole("button", { name: /impresora/i }));
    const retry = await screen.findByRole("button", { name: /reintentar/i });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renderiza el historial con role=list y entradas legibles", async () => {
    renderPill({ timeline: ["10:00 ok → warn", "10:05 warn → off"] });
    fireEvent.click(screen.getByRole("button", { name: /impresora/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/historial/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/10:00 ok → warn/)).toBeInTheDocument();
    expect(within(dialog).getByText(/10:05 warn → off/)).toBeInTheDocument();
  });
});
