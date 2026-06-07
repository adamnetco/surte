import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SaleCompleteDialog from "./SaleCompleteDialog";

/**
 * Garantiza que la pantalla de cierre de venta NUNCA bloquee el flujo:
 *  - Se muestra con total/recibido/vuelto.
 *  - "Nueva venta" dispara onNewSale y cierra el diálogo (libera overlay).
 *  - Esc (onOpenChange(false)) también libera el overlay.
 *  - Facturar respeta canEmitInvoice.
 */
describe("SaleCompleteDialog — no bloquea el cierre del flujo", () => {
  const baseProps = {
    open: true,
    total: 25000,
    amountPaid: 30000,
    change: 5000,
    canEmitInvoice: true,
  };

  it("muestra total, recibido y vuelto formateados", () => {
    render(
      <SaleCompleteDialog
        {...baseProps}
        onOpenChange={() => {}}
        onNewSale={() => {}}
        onPrint={() => {}}
        onEmitInvoice={() => {}}
      />,
    );
    expect(screen.getByText("Venta completada")).toBeInTheDocument();
    expect(screen.getByText("$25.000")).toBeInTheDocument();
    expect(screen.getByText("$30.000")).toBeInTheDocument();
    expect(screen.getByText("$5.000")).toBeInTheDocument();
  });

  it("'Nueva venta' invoca onNewSale y cierra el diálogo (sin overlay residual)", () => {
    const onNewSale = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <SaleCompleteDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        onNewSale={onNewSale}
        onPrint={() => {}}
        onEmitInvoice={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /nueva venta/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNewSale).toHaveBeenCalledTimes(1);
  });

  it("oculta el bloque de vuelto cuando change=0 (cobro exacto)", () => {
    render(
      <SaleCompleteDialog
        {...baseProps}
        amountPaid={25000}
        change={0}
        onOpenChange={() => {}}
        onNewSale={() => {}}
        onPrint={() => {}}
        onEmitInvoice={() => {}}
      />,
    );
    expect(screen.queryByText("Vuelto")).not.toBeInTheDocument();
  });

  it("deshabilita 'Facturar' cuando canEmitInvoice=false", () => {
    render(
      <SaleCompleteDialog
        {...baseProps}
        canEmitInvoice={false}
        onOpenChange={() => {}}
        onNewSale={() => {}}
        onPrint={() => {}}
        onEmitInvoice={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /facturar/i })).toBeDisabled();
  });
});
