import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const DEVELOPER_EMAILS = new Set([
  "venomx2424@gmail.com",
  "visionx2425@gmail.com",
]);

const fallbackProfile = (session) => {
  const email = session?.user?.email?.trim().toLowerCase() || "";
  return {
    id: session.user.id,
    email,
    full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "MahaFlow user",
    role: DEVELOPER_EMAILS.has(email) ? "developer" : "passenger",
    status: "active",
  };
};

const resolveProfile = async (session) => {
  const safeFallback = fallbackProfile(session);
  const profileSources = [
    { table: "mahaflow_profiles", columns: "id,email,display_name,role,mobile,state,district,organization,designation,status,facility_id" },
    { table: "profiles", columns: "id,email,full_name,role,status" },
  ];

  let data = null;
  for (const source of profileSources) {
    try {
      const result = await supabase
        .from(source.table)
        .select(source.columns)
        .eq("id", session.user.id)
        .maybeSingle();
      if (!result.error && result.data) {
        data = result.data;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!data) return safeFallback;
  const merged = { ...safeFallback, ...data, full_name: data.full_name || data.display_name || safeFallback.full_name };
  if (safeFallback.role === "developer") return { ...merged, role: "developer" };
  if (!['passenger', 'authority'].includes(data.role)) return { ...merged, role: "passenger" };
  return merged;
};

export const useAuthSession = () => {
  const [state, setState] = useState({
    session: null,
    profile: null,
    loading: true,
    error: "",
  });
  const requestRef = useRef(0);

  const applySession = useCallback(async (nextSession) => {
    const requestId = ++requestRef.current;
    if (!nextSession) {
      setState({ session: null, profile: null, loading: false, error: "" });
      return;
    }

    setState((current) => ({ ...current, session: nextSession, loading: true, error: "" }));
    const profile = await resolveProfile(nextSession);
    if (requestRef.current !== requestId) return;

    if (window.location.pathname === "/auth/callback") {
      const recovery = new URLSearchParams(window.location.search).get("recovery") === "1" || localStorage.getItem("mahaflow-password-recovery") === "true";
      window.history.replaceState({}, document.title, recovery ? "/reset-password" : "/");
    }
    setState({ session: nextSession, profile, loading: false, error: "" });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setState({ session: null, profile: null, loading: false, error: "Supabase Auth is not configured." });
      return undefined;
    }

    let mounted = true;
    const callbackError = new URLSearchParams(window.location.search).get("error_description");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") localStorage.setItem("mahaflow-password-recovery", "true");
      if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY", "SIGNED_OUT"].includes(event)) {
        void applySession(nextSession);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setState({ session: null, profile: null, loading: false, error: error.message });
        return;
      }
      if (callbackError && !data.session) {
        sessionStorage.removeItem("mahaflow-authority-onboarding");
        setState({ session: null, profile: null, loading: false, error: decodeURIComponent(callbackError) });
        return;
      }
      void applySession(data.session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    sessionStorage.removeItem("mahaflow-authority-onboarding");
    await supabase.auth.signOut({ scope: "local" });
    setState({ session: null, profile: null, loading: false, error: "" });
  }, []);

  return {
    ...state,
    role: state.profile?.role || "passenger",
    applySession,
    signOut,
  };
};