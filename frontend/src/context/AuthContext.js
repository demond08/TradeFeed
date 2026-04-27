import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme) => {
    if (theme === "light") {
      document.body.classList.add("theme-light");
    } else {
      document.body.classList.remove("theme-light");
    }
  };

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      applyTheme(data.theme || "dark");
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // If returning from Emergent OAuth callback, skip /me check
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("tfx_token", data.token);
    setUser(data.user);
    applyTheme(data.user.theme || "dark");
    return data.user;
  };

  const signup = async (email, password, username) => {
    const { data } = await api.post("/auth/signup", { email, password, username });
    localStorage.setItem("tfx_token", data.token);
    setUser(data.user);
    applyTheme(data.user.theme || "dark");
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("tfx_token");
    setUser(null);
  };

  const updateUser = (u) => {
    setUser(u);
    applyTheme(u.theme || "dark");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh, updateUser, applyTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
