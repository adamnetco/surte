// Public barrel for the auth module.
// Consumers must import from "@/modules/auth", NOT deep paths.
export { AuthProvider, useAuth } from "./context/AuthContext";
export type { AppRole } from "./context/AuthContext";
export { default as RoleGuard } from "./components/RoleGuard";
export { default as SSOErrorScreen } from "./components/SSOErrorScreen";
export { buildHandoffUrl, consumeHandoff, tenantHost } from "./lib/ssoHandoff";
export type { SSOError } from "./lib/ssoHandoff";
export { default as LoginPage } from "./pages/Login";
export { default as LoginRouterPage } from "./pages/LoginRouter";
export { default as ResetPasswordPage } from "./pages/ResetPassword";
export { default as UnsubscribePage } from "./pages/Unsubscribe";
