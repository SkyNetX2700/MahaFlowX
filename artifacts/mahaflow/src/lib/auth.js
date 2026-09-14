export const getAuthRedirectUrl = (suffix = "") => {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL || import.meta.env.REACT_APP_AUTH_REDIRECT_URL;
  const viteBase = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const base = configured || `${window.location.origin}${viteBase}/auth/callback`;
  return `${base}${suffix}`;
};

export const getGoogleAuthError = (error) => {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();

  if (!message) return "Google sign-in could not be started. Please try again.";
  if (normalized.includes("provider") && (normalized.includes("not enabled") || normalized.includes("unsupported"))) {
    return "Google sign-in is not enabled yet. Enable the Google provider in Supabase Auth, then try again.";
  }
  if (normalized.includes("redirect") || normalized.includes("redirect_uri") || normalized.includes("not allowed")) {
    return "This app URL is not allowlisted for Google sign-in. Add this deployment URL to Supabase Auth redirect URLs.";
  }
  if (normalized.includes("cancel") || normalized.includes("denied")) {
    return "Google sign-in was cancelled.";
  }

  return message;
};