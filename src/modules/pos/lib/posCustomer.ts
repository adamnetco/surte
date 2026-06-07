/** Cliente del POS (en memoria por ahora; persistirá en Fase 2). */
export interface POSCustomer {
  id?: string;                // undefined = aún no persistido
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  docType?: "CC" | "NIT" | "CE" | "PAS" | "TI" | "OTRO";
  docNumber?: string;
  personType?: "natural" | "juridica";
  taxResponsibility?: string; // p.ej. "Responsable de IVA"
  city?: string;
  // Preferencias de envío de comprobante:
  sendWhatsapp?: boolean;
  sendEmail?: boolean;
}

export const CONSUMIDOR_FINAL: POSCustomer = {
  id: "consumidor_final",
  name: "Consumidor final",
  docType: "CC",
  docNumber: "222222222222",
};

export const isConsumidorFinal = (c?: POSCustomer | null) =>
  !!c && c.id === "consumidor_final";
