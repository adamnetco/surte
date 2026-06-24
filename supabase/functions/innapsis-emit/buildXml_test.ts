import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFeXml } from "./buildXml.ts";

Deno.test("buildFeXml emite estructura Fe v1.9 con orden de secciones", () => {
  const xml = buildFeXml({
    trackId: "abc-123",
    Fe: {
      Detalles: [
        { NumeroLinea: 1, CodigoItem: "SKU1", CantidadItem: 2, ValorItem: 1000, DescripcionItem: "Café" },
      ],
      Encabezado: {
        FechaEmision: "2026-06-24",
        TipoDocumento: "1",
        FolioAutorizado: 42,
      },
      Emisor: { RazonSocial: "Acme & Co", Identificacion: "900000000", Dv: "1" },
      Receptor: { RazonSocial: "Cliente <Final>", Identificacion: "222222222222" },
      Totales: { TotalaPagar: 2000, Moneda: "COP" },
      TaxTotal: [
        { CodigoTax: "01", PorcTax: 19, ValorTax: 380, BaseTaxTotal: 2000 },
      ],
    },
  });
  assertStringIncludes(xml, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(xml, '<Fe trackId="abc-123">');
  // Encabezado debe ir antes que Emisor, Emisor antes que Receptor, Detalles al final.
  const idxEnc = xml.indexOf("<Encabezado>");
  const idxEmisor = xml.indexOf("<Emisor>");
  const idxReceptor = xml.indexOf("<Receptor>");
  const idxTotales = xml.indexOf("<Totales>");
  const idxTax = xml.indexOf("<TaxTotal>");
  const idxDet = xml.indexOf("<Detalles>");
  assertEquals(idxEnc < idxEmisor, true);
  assertEquals(idxEmisor < idxReceptor, true);
  assertEquals(idxReceptor < idxTotales, true);
  assertEquals(idxTotales < idxTax, true);
  assertEquals(idxTax < idxDet, true);
  // Escapado XML correcto.
  assertStringIncludes(xml, "Acme &amp; Co");
  assertStringIncludes(xml, "Cliente &lt;Final&gt;");
  // Detalles repetidos.
  assertStringIncludes(xml, "<CodigoItem>SKU1</CodigoItem>");
  assertStringIncludes(xml, "<CantidadItem>2</CantidadItem>");
});

Deno.test("buildFeXml omite null/undefined/cadenas vacías", () => {
  const xml = buildFeXml({
    trackId: "t",
    Fe: {
      Encabezado: { FechaEmision: "2026-06-24", FolioAutorizado: 1, Prefijo: "" },
      Emisor: { RazonSocial: "X", Dv: null },
    },
  });
  assertEquals(xml.includes("<Prefijo>"), false);
  assertEquals(xml.includes("<Dv>"), false);
});
