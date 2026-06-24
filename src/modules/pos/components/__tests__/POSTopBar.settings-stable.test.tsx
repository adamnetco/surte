/**
 * Regression: el ícono Settings del POSTopBar DEBE permanecer anclado en el
 * cluster derecho cuando el botón de sync alterna estados
 * (idle → syncing → pendientes → idle), y a través de los breakpoints
 * mobile (390px), tablet (768px) y desktop (1280px).
 *
 * Causa raíz histórica (ver mem://tech/layout-jitter-pos-topbar): cuando el
 * widget de sync se montaba/desmontaba o cambiaba de texto ("Sync…" ↔ "2"),
 * el cluster derecho se re-metría y Settings se desplazaba 25-55px,
 * dando la sensación de aparecer/desaparecer.
 *
 * Fix: el slot de sync vive DENTRO de POSTopBar con ancho fijo (28px) y un
 * placeholder invisible cuando no hay actividad. Estos tests congelan ese
 * contrato.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import POSTopBar, { type POSTopBarSyncState } from "../POSTopBar";

const baseProps = {
  shiftLabel: "Turno #12",
  cashierName: "Eduardo",
  openedAt: new Date().toISOString(),
  modes: ["mesa", "autoservicio"] as any,
  activeMode: "autoservicio" as any,
  onChangeMode: () => {},
  onCloseShift: () => {},
  onOpenShortcuts: () => {},
};

function renderAt(width: number, sync?: POSTopBarSyncState) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
  return render(
    <MemoryRouter initialEntries={["/pos/vender"]}>
      <POSTopBar {...baseProps} sync={sync} />
    </MemoryRouter>
  );
}

const IDLE: POSTopBarSyncState  = { pending: 0, syncing: false, online: true };
const SYNC: POSTopBarSyncState  = { pending: 0, syncing: true,  online: true };
const PEND: POSTopBarSyncState  = { pending: 2, syncing: false, online: true };
const OFF:  POSTopBarSyncState  = { pending: 5, syncing: false, online: false };

describe("POSTopBar — Settings anclado bajo cambios de sync", () => {
  afterEach(() => cleanup());

  it.each([
    ["idle",     IDLE],
    ["syncing",  SYNC],
    ["pending",  PEND],
    ["offline",  OFF],
    ["sin sync", undefined],
  ])("renderiza el ícono Settings con estado=%s", (_label, sync) => {
    renderAt(1280, sync);
    expect(screen.getByLabelText("Abrir configuración del POS")).toBeInTheDocument();
  });

  it("el slot de sync mantiene ancho fijo (w-7) en TODOS los estados — sin reflow", () => {
    for (const s of [undefined, IDLE, SYNC, PEND, OFF]) {
      const { unmount } = renderAt(1280, s);
      const slot = screen.getByTestId("pos-topbar-sync-slot");
      expect(slot.className).toMatch(/\bw-7\b/);
      expect(slot.className).toMatch(/\bshrink-0\b/);
      unmount();
    }
  });

  it("Settings visible en mobile (390), tablet (768) y desktop (1280)", () => {
    for (const w of [390, 768, 1280]) {
      const { unmount } = renderAt(w, PEND);
      const btn = screen.getByLabelText("Abrir configuración del POS");
      // No usa hidden md:; debe estar SIEMPRE en el DOM y sin clases que lo oculten
      expect(btn).toBeInTheDocument();
      expect(btn.className).not.toMatch(/\bhidden\b/);
      unmount();
    }
  });

  it("muestra badge de pendientes y desaparece cuando pending=0 (sin alterar slot)", () => {
    const { rerender } = render(
      <MemoryRouter><POSTopBar {...baseProps} sync={PEND} /></MemoryRouter>
    );
    expect(screen.getByTestId("pos-topbar-sync-btn")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    rerender(<MemoryRouter><POSTopBar {...baseProps} sync={IDLE} /></MemoryRouter>);
    // botón fuera, slot dentro
    expect(screen.queryByTestId("pos-topbar-sync-btn")).toBeNull();
    expect(screen.getByTestId("pos-topbar-sync-slot")).toBeInTheDocument();
    // Settings sigue ahí
    expect(screen.getByLabelText("Abrir configuración del POS")).toBeInTheDocument();
  });
});
