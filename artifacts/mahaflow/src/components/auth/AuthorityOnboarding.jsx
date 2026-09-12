import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, KeyRound, MapPin } from "lucide-react";
import { completeAuthorityOnboarding, verifyAuthorityCode } from "@/lib/supabaseData";
import { BrandLogo } from "@/components/BrandLogo";

export const AuthorityOnboarding = ({ session, onComplete, onCancel }) => {
  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const verified = await verifyAuthorityCode(code); if (!verified) throw new Error("No facility was returned for this code."); setDetails(verified); setStep("profile"); }
    catch (error) { setMessage(error.message || "This code cannot be used."); }
    finally { setBusy(false); }
  };

  const complete = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      await completeAuthorityOnboarding({ p_code: code, p_display_name: form.get("full-name"), p_mobile: form.get("mobile"), p_organization: form.get("organization"), p_designation: form.get("designation") });
      sessionStorage.removeItem("mahaflow-authority-onboarding");
      await onComplete();
    } catch (error) { setMessage(error.message || "Authority registration could not be completed."); setBusy(false); }
  };

  return <main className="onboarding-shell" data-testid="authority-onboarding-page"><header><BrandLogo testId="authority-onboarding-logo"/><button className="outline-button" data-testid="authority-onboarding-cancel-button" onClick={onCancel}><ArrowLeft size={16}/> Back to main sign in</button></header><section className="onboarding-panel">
    <div className="step-track" data-testid="authority-onboarding-progress"><span className="active">1</span><i/><span className={step === "profile" ? "active" : ""}>2</span><i/><span>3</span></div>
    {step === "code" ? <form onSubmit={verify}><div className="modal-icon"><KeyRound/></div><span className="eyebrow purple">STEP 1 · FACILITY CODE</span><h1>Connect your assigned facility.</h1><p>Signed in as {session.user.email}. Enter the one-time code issued by a MahaFlow developer.</p><label>Authority access code<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} data-testid="onboarding-access-code-input" placeholder="MFB-XXXXXX or MFR-XXXXXX" required/></label><button className="primary-button" data-testid="onboarding-verify-code-button" disabled={busy}>{busy ? "Verifying…" : "Verify facility code"}<ArrowRight size={17}/></button></form> : <form onSubmit={complete}><div className="modal-icon"><Building2/></div><span className="eyebrow purple">STEP 2 · OPERATOR PROFILE</span><h1>Complete your authority profile.</h1><p>Your transport type and facility are locked to the verified code.</p><div className="form-grid"><label>Full name<input name="full-name" data-testid="onboarding-full-name-input" required/></label><label>Mobile number<input name="mobile" type="tel" data-testid="onboarding-mobile-input" required/></label><label>Organization<input name="organization" data-testid="onboarding-organization-input" placeholder="MSRTC, Central Railway…"/></label><label>Designation<input name="designation" data-testid="onboarding-designation-input" placeholder="Station manager"/></label><label>State<input readOnly value={details.state} data-testid="onboarding-state-input"/></label><label>District<input readOnly value={details.district} data-testid="onboarding-district-input"/></label><label>Transport type<select disabled value={details.network} data-testid="onboarding-network-select"><option value={details.network} label={details.network === "bus" ? "Bus Stand" : "Railway Station"}/></select></label><label>Assigned facility<select disabled value={details.location_name} data-testid="onboarding-facility-select"><option value={details.location_name} label={details.location_name}/></select></label></div><div className="verified-facility" data-testid="onboarding-verified-facility"><Check/><span><b>{details.location_name}</b><small><MapPin size={12}/>{details.stand_address}</small></span></div><button className="primary-button" data-testid="onboarding-complete-button" disabled={busy}>{busy ? "Creating workspace…" : "Open authority workspace"}<ArrowRight size={17}/></button></form>}
    {message && <div className="inline-message" data-testid="onboarding-message">{message}</div>}
  </section></main>;
};