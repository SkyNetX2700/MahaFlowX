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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) {
        setMessage(getGoogleAuthError(error));
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
        <button type="button" className="google-button" data-testid="google-signin-button" disabled={busy || !supabase} title={supabase ? t("auth.continueGoogle") : t("auth.googleUnavailable")} onClick={google}><span className="google-g">G</span>{supabase ? t("auth.continueGoogle") : t("auth.googleUnavailable")}</button>
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