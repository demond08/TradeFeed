import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, username || email.split("@")[0]);
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirect = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-black text-5xl tracking-tighter mb-2" data-testid="brand-title">TRADEFEEDX</h1>
        <p className="text-zinc-500 text-sm mb-8 uppercase tracking-[0.25em] font-mono-tab">Social feed for traders</p>

        <form onSubmit={onSubmit} className="space-y-3" data-testid="auth-form">
          {mode === "signup" && (
            <input
              data-testid="username-input"
              className="w-full bg-transparent border border-zinc-700 px-4 py-3 outline-none focus:border-white text-sm"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
            />
          )}
          <input
            data-testid="email-input"
            type="email"
            className="w-full bg-transparent border border-zinc-700 px-4 py-3 outline-none focus:border-white text-sm"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            data-testid="password-input"
            type="password"
            className="w-full bg-transparent border border-zinc-700 px-4 py-3 outline-none focus:border-white text-sm"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
          />
          <button
            data-testid="submit-auth"
            type="submit"
            disabled={busy}
            className="w-full bg-white text-black font-bold py-3 uppercase tracking-widest text-sm active:scale-95 disabled:opacity-60"
          >
            {busy ? "…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4 text-zinc-600 text-xs uppercase tracking-widest">
          <div className="flex-1 h-px bg-zinc-800" /> or <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <button
          data-testid="google-login"
          onClick={googleLogin}
          className="w-full border border-zinc-700 hover:border-white text-white font-semibold py-3 uppercase tracking-widest text-sm"
        >
          Continue with Google
        </button>

        <button
          data-testid="toggle-auth-mode"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-6 w-full text-zinc-400 text-xs uppercase tracking-widest"
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
