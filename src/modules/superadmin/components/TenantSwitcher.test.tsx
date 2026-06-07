import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TenantSwitcher from "@/modules/superadmin/components/TenantSwitcher";

const switchOrg = vi.fn();
let mockOrg: any = { id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" };

vi.mock("@/modules/platform/context/OrganizationContext", () => ({
  useOrganization: () => ({
    orgs: [
      { id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" },
      { id: "o2", slug: "tienda-dos", name: "Tienda Dos", role: "owner" },
    ],
    currentOrg: mockOrg,
    switchOrg,
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<TenantSwitcher />} />
      </Routes>
    </MemoryRouter>
  );

describe("TenantSwitcher", () => {
  beforeEach(() => {
    switchOrg.mockReset();
    mockOrg = { id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" };
  });

  it("muestra la tienda activa", () => {
    renderAt("/superadmin");
    expect(screen.getByText("Tienda Uno")).toBeInTheDocument();
  });

  it("abre el popover y lista todas las tiendas", () => {
    renderAt("/superadmin");
    fireEvent.click(screen.getByText("Tienda Uno"));
    expect(screen.getByText("Tienda Dos")).toBeInTheDocument();
  });

  it("filtra al escribir en el buscador", () => {
    renderAt("/superadmin");
    fireEvent.click(screen.getByText("Tienda Uno"));
    fireEvent.change(screen.getByPlaceholderText("Buscar tienda…"), { target: { value: "dos" } });
    // "Tienda Uno" sigue visible solo en el trigger, no en la lista filtrada.
    expect(screen.getAllByText("Tienda Uno")).toHaveLength(1);
    expect(screen.getByText("Tienda Dos")).toBeInTheDocument();
  });


  it("al elegir otra tienda llama switchOrg", () => {
    renderAt("/superadmin");
    fireEvent.click(screen.getByText("Tienda Uno"));
    fireEvent.click(screen.getByText("Tienda Dos"));
    expect(switchOrg).toHaveBeenCalledWith("o2");
  });
});
