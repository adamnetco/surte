export * from "./lib/subdomain";
export * from "./lib/tenantScope";
export * from "./lib/tenantDataIsland";
export { useTenantFromRoute } from "./hooks/useTenantFromRoute";
export { useTenantProfile, type TenantProfile } from "./hooks/useTenantProfile";
export { useTenantSettings } from "./hooks/useTenantSettings";
export {
  useTenantBranding,
  useTenantContact,
  useTenantLegal,
  useTenantSeo,
} from "./hooks/useTenantFacets";
