import React, { useState } from "react";
import axios from "axios";
import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowRight, CircleHelp, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
import { AuthorityAuthModal } from "@/components/auth/AuthorityAuthModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n";
import { getAuthRedirectUrl, getGoogleAuthError } from "@/lib/auth";

const API = `${import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || ""}/api`;
const transitImage = "https://images.unsplash.com/photo-1582217900003-2b19c0e3a7d0?crop=entropy&cs=srgb&fm=jpg&q=85";
const GoogleLogo = () => <svg className="google-g" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.74 9.74 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.51 13.82A5.86 5.86 0 0 1 6.2 12c0-.63.11-1.24.31-1.82V7.65H3.27A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.02 4.35l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.14c1.43 0 2.72.49 3.74 1.45l2.8-2.8C16.84 3.12 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.73 5.4l3.24 2.53c.78-2.32 2.94-4.04 5.49-4.04Z"/></svg>;

export const AuthPage = ({ onAuthenticated, authError = "" }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState("signin");
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const [message, setMessage] = useState(authError);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || import.meta.env.REACT_APP_TURNSTILE_SITE_KEY;
  const authUnavailable = t("auth.authUnavailable");

  const verifyHuman = async () => {
    if (mode !== "signup") return true;
    if (!turnstileToken) {
      setMessage(t("auth.securityCheck"));
      return false;
    }
    try {
      await axios.post(`${API}/security/turnstile/verify`, { token: turnstileToken });
      return true;
    } catch (error) {
      setMessage(error.response?.data?.detail || t("auth.securityFailed"));
      return false;
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setMessage(authUnavailable);
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = form.get("email")?.trim();
    const password = form.get("password");
    setBusy(true);
    setMessage("");
    if (!await verifyHuman()) {
      setBusy(false);
      return;
    }
    const response = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthRedirectUrl() } });
    if (response.error) setMessage(response.error.message);
    else if (response.data.session) await onAuthenticated(response.data.session);
    else setMessage(t("auth.resetSent"));
    setBusy(false);
    setTurnstileToken("");
    setTurnstileKey(value => value + 1);
  };

  const google = async () => {
    if (!supabase) {
      setMessage(authUnavailable);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: true,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) {
        setMessage(getGoogleAuthError(error));
        setBusy(false);
      } else if (data?.url) {
        window.location.assign(data.url);
      } else {
        setMessage("Google sign-in did not return a provider URL. Check the Supabase Google provider configuration.");
        setBusy(false);
      }
    } catch (error) {
      setMessage(getGoogleAuthError(error));
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!supabase) {
      setMessage(authUnavailable);
      return;
    }
    const email = document.querySelector('[data-testid="auth-email-input"]')?.value;
    if (!email) {
      setMessage(t("auth.enterEmail"));
      return;
    }
    localStorage.setItem("mahaflow-password-recovery", "true");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("?recovery=1"),
    });
    setMessage(error?.message || t("auth.resetSent"));
  };

  return <main className="auth-shell" data-testid="auth-page">
    <section className="auth-visual" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,18,55,.08), rgba(7,18,55,.83)), url(${transitImage})` }}>
      <BrandLogo light testId="auth-hero-logo"/>
      <div className="visual-copy">
        <div className="eyebrow"><Sparkles size={14}/> {t("auth.publicTransport")}</div>
        <h1>{t("auth.heroTitle")}<br/><em>{t("auth.heroTitleAccent")}</em></h1>
        <p>{t("auth.heroBody")}</p>
        <div className="visual-stats">
          <span><b>3</b><small>{t("auth.languages")}</small></span>
          <span><b>24/7</b><small>{t("auth.liveVisibility")}</small></span>
          <span><b>∞</b><small>{t("auth.betterJourneys")}</small></span>
        </div>
      </div>
      <div className="visual-footer">MAHARASHTRA • SMART MOBILITY NETWORK <span>01 / 03</span></div>
    </section>
    <section className="auth-panel">
      <div className="auth-content">
        <div className="mobile-logo"><BrandLogo testId="auth-mobile-logo"/></div>
        <div className="auth-top">
          <span className="pill"><UserRound size={15}/>{mode === "signin" ? t("auth.welcomeBack") : t("auth.newPassenger")}</span>
          <LanguageSwitcher />
        </div>
        <h2>{mode === "signin" ? <>{t("auth.signInTo")} <strong>MahaFlow</strong></> : <>{t("auth.createYour")} <strong>{t("auth.passengerAccount")}</strong></>}</h2>
        <p className="auth-subtitle">{t("auth.subtitle")}</p>
        <form onSubmit={submit}>
          <label>{t("auth.email")}<input name="email" data-testid="auth-email-input" type="email" placeholder={t("auth.emailPlaceholder")} autoComplete="email" required/></label>
          <label>{t("auth.password")}<input name="password" data-testid="auth-password-input" type="password" minLength="6" placeholder={mode === "signin" ? t("auth.passwordPlaceholder") : t("auth.createPassword")} autoComplete={mode === "signin" ? "current-password" : "new-password"} required/></label>
          {mode === "signin" && <div className="form-row">
            <label className="check"><input type="checkbox" data-testid="remember-me-checkbox" defaultChecked/><span>{t("auth.keepSignedIn")}</span></label>
            <button type="button" className="text-button" data-testid="forgot-password-button" onClick={forgot}>{t("auth.forgotPassword")}</button>
          </div>}
          {mode === "signup" && turnstileSiteKey && <Turnstile key={turnstileKey} siteKey={turnstileSiteKey} options={{ action: "signup" }} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken("")} onError={() => setTurnstileToken("")} data-testid="turnstile-widget"/>}
     <button className="primary-button" data-testid="auth-submit-button" disabled={busy}>{busy ? "…" : mode === "signin" ? t("auth.signIn") : t("auth.createAccount")}<ArrowRight size={18}/></button>
        </form>
        <div className="divider"><span>{t("auth.or")}</span></div>
         <button type="button" className="google-button" data-testid="google-signin-button" disabled={busy || !supabase} title={supabase ? t("auth.continueGoogle") : t("auth.googleUnavailable")} onClick={google}><GoogleLogo/>{supabase ? t("auth.continueGoogle") : t("auth.googleUnavailable")}</button>
        <button type="button" className="access-button" data-testid="access-code-open-button" onClick={() => setAuthorityOpen(true)}><KeyRound size={17}/>{t("auth.accessCode")}<ArrowRight size={16}/></button>
        {mode === "signin"
          ? <p className="switch-copy">{t("auth.newHere")} <button type="button" data-testid="create-account-button" className="text-button" onClick={() => { setMode("signup"); setMessage(""); }}>{t("auth.createAccount")} <ArrowRight size={14}/></button></p>
          : <p className="switch-copy"><button type="button" data-testid="back-to-signin-button" className="text-button" onClick={() => { setMode("signin"); setMessage(""); }}>← {t("auth.backToSignIn")}</button></p>}
        {message && <div className="inline-message" data-testid="auth-message"><CircleHelp size={16}/>{message}</div>}
        <div className="auth-setup"><ShieldCheck size={15}/>{t("auth.protected")}</div>
      </div>
    </section>
    {authorityOpen && <AuthorityAuthModal onClose={() => setAuthorityOpen(false)} onAuthenticated={onAuthenticated}/>}
  </main>;
};