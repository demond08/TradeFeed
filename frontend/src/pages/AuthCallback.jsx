import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/login", { replace: true }); return; }
    const session_id = decodeURIComponent(m[1]);

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        if (data.token) localStorage.setItem("tfx_token", data.token);
        await refresh();
        nav("/", { replace: true });
      } catch (e) {
        nav("/login", { replace: true });
      }
    })();
  }, [nav, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono-tab text-xs uppercase tracking-widest">
      Establishing session…
    </div>
  );
}
