import React, { useState } from "react";
import { ArrowRight, CircleHelp, KeyRound, Mail, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAuthRedirectUrl, getGoogleAuthError } from "@/lib/auth";

export const AuthorityAuthModal = ({ onClose, onAuthenticated }) => {
  const [createAccount, setCreateAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const beginGoogle = async () => {
    if (!supabase) {
      setMessage("Google sign-in is unavailable until Supabase Auth is configured.");
      return;
    }
    sessionStorage.setItem("mahaflow-authority-onboarding", "true");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getAuthRedirectUrl(), queryParams: { access_type: "offline", prompt: "consent" } },
      });
      if (error) {
        sessionStorage.removeItem("mahaflow-authority-onboarding");
        setMessage(getGoogleAuthError(error));
        setBusy(false);
      }
    } catch (error) {
      sessionStorage.removeItem("mahaflow-authority-onboarding");
      setMessage(getGoogleAuthError(error));
      setBusy(false);
    }
  };

  const submitEmail = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase Auth is not configured for this deployment.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = form.get("authority-email")?.trim();
    const password = form.get("authority-password");
    setBusy(true); setMessage("");
    sessionStorage.setItem("mahaflow-authority-onboarding", "true");
    const response = createAccount
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthRedirectUrl() } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (response.error) setMessage(response.error.message);
    else if (response.data.session) await onAuthenticated(response.data.session);
    else setMessage("Confirm your email, then return here to complete authority setup.");
    setBusy(false);
  };

  return <div className="modal-backdrop" data-testid="authority-auth-modal"><div className="modal authority-auth-card">
    <button className="icon-button close" data-testid="authority-auth-close-button" aria-label="Close authority sign in" onClick={onClose}><X size={18}/></button>
    <div className="modal-icon"><KeyRound/></div><span className="eyebrow purple">AUTHORITY ONBOARDING</span>
    <h3>Secure your operator account</h3><p>Sign in first. Your one-time facility code is verified only after authentication.</p>
    <button type="button" className="google-button" data-testid="authority-google-button" disabled={busy || !supabase} onClick={beginGoogle}><span className="google-g">G</span> Continue with Google</button>
    <div className="divider"><span>OR USE EMAIL</span></div>
    <form className="authority-auth-form" onSubmit={submitEmail}>
      <label>Email<input name="authority-email" type="email" required data-testid="authority-email-input" placeholder="operator@example.com"/></label>
      <label>Password<input name="authority-password" type="password" minLength="6" required data-testid="authority-password-input" placeholder="Enter your password"/></label>
      <button className="primary-button" data-testid="authority-email-submit-button" disabled={busy}><Mail size={17}/>{createAccount ? "Create authority account" : "Continue with email"}<ArrowRight size={17}/></button>
    </form>
    <button className="text-button auth-mode-switch" data-testid="authority-auth-mode-button" onClick={() => { setCreateAccount(value => !value); setMessage(""); }}>{createAccount ? "Already registered? Sign in" : "New operator? Create an account"}</button>
    {message && <div className="inline-message" data-testid="authority-auth-message"><CircleHelp size={16}/>{message}</div>}
  </div></div>;
};