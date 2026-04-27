import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Lock, Sun, Moon, LogOut, User } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const nav = useNavigate();
  const [bio, setBio] = useState(user?.bio || "");
  const [name, setName] = useState(user?.name || "");

  if (!user) { nav("/login"); return null; }

  const toggle = async (patch) => {
    try {
      const { data } = await api.patch("/me/settings", patch);
      updateUser(data);
    } catch {}
  };

  const saveProfile = async () => {
    await toggle({ bio, name });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => nav(-1)} data-testid="settings-back"><ArrowLeft /></button>
        <div className="font-display font-black text-sm uppercase tracking-widest">Settings</div>
      </header>

      <div className="max-w-lg mx-auto divide-y divide-border">
        <section className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-mono-tab">
            <User size={14} /> Profile
          </div>
          <input data-testid="settings-name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Display name" className="w-full bg-secondary px-3 py-2.5 rounded-xl text-sm outline-none" />
          <textarea data-testid="settings-bio" value={bio} onChange={(e)=>setBio(e.target.value)} placeholder="Bio" rows={2} className="w-full bg-secondary px-3 py-2.5 rounded-xl text-sm outline-none" />
          <button data-testid="save-profile" onClick={saveProfile} className="bg-foreground text-background px-4 py-2 rounded-full font-semibold text-sm">Save</button>
        </section>

        <section className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock size={18} />
              <div>
                <div className="font-semibold text-sm">Private account</div>
                <div className="text-xs text-muted-foreground">Only followers can see your posts</div>
              </div>
            </div>
            <button
              data-testid="toggle-private"
              onClick={() => toggle({ is_private: !user.is_private })}
              className={`w-12 h-6 rounded-full transition-colors ${user.is_private ? "bg-[#00C805]" : "bg-zinc-700"}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${user.is_private ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              <div>
                <div className="font-semibold text-sm">Theme</div>
                <div className="text-xs text-muted-foreground">{user.theme === "light" ? "Light" : "Dark"} mode</div>
              </div>
            </div>
            <button
              data-testid="toggle-theme"
              onClick={() => toggle({ theme: user.theme === "light" ? "dark" : "light" })}
              className="px-3.5 py-1.5 bg-secondary rounded-full text-xs font-semibold"
            >
              Switch
            </button>
          </div>
        </section>

        <section className="p-4">
          <button
            data-testid="logout-btn"
            onClick={async () => { await logout(); nav("/login"); }}
            className="flex items-center gap-2 text-[#FF3B30] font-bold text-sm uppercase tracking-widest"
          >
            <LogOut size={16} /> Log out
          </button>
        </section>
      </div>
    </div>
  );
}
