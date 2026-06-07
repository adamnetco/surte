import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireActiveTenant from "@/modules/superadmin/components/RequireActiveTenant";

const switchOrg = vi.fn();
let mockState: any = {
  orgs: [{ id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" }],
  currentOrg: null,
  loading: false,
};

vi.mock("@/context/OrganizationContext", () => ({
  useOrganization: () => ({ ...mockState, switchOrg }),
}));

const Child = () => <div>contenido-tenant</div>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/superadmin" element={<RequireActiveTenant><Child /></RequireActiveTenant>} />
        <Route path="/superadmin/t/:slug" element={<RequireActiveTenant><Child /></RequireActiveTenant>} />
        <Route path="/superadmin/tiendas" element={<div>listado-tiendas</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("RequireActiveTenant", () => {
  it("muestra estado vacío si no hay tienda activa y no hay slug", () => {
    mockState = { orgs: [], currentOrg: null, loading: false };
    renderAt("/superadmin");
    expect(screen.getByText(/Elige una tienda/i)).toBeInTheDocument();
  });

  it("renderiza el hijo si hay tienda activa", () => {
    mockState = {
      orgs: [{ id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" }],
      currentOrg: { id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" },
      loading: false,
    };
    renderAt("/superadmin");
    expect(screen.getByText("contenido-tenant")).toBeInTheDocument();
  });

  it("redirige a /superadmin/tiendas si el slug de la URL no existe", () => {
    mockState = {
      orgs: [{ id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" }],
      currentOrg: null,
      loading: false,
    };
    renderAt("/superadmin/t/no-existe");
    expect(screen.getByText("listado-tiendas")).toBeInTheDocument();
  });

  it("sincroniza la org activa con el slug de la URL", () => {
    switchOrg.mockReset();
    mockState = {
      orgs: [{ id: "o1", slug: "tienda-uno", name: "Tienda Uno", role: "owner" }],
      currentOrg: null,
      loading: false,
    };
    renderAt("/superadmin/t/tienda-uno");
    expect(switchOrg).toHaveBeenCalledWith("o1");
  });

  it("muestra loader mientras carga", () => {
    mockState = { orgs: [], currentOrg: null, loading: true };
    renderAt("/superadmin");
    expect(screen.getByText(/Cargando tiendas/i)).toBeInTheDocument();
  });
});
