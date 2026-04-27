import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Search, Camera, Bell, User } from "lucide-react";

const linkBase = "flex flex-col items-center justify-center flex-1 h-full gap-1 text-[10px] font-semibold";

export default function BottomNav({ username }) {
  const nav = useNavigate();
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 inset-x-0 z-50 h-16 border-t border-zinc-800 bg-black/90 backdrop-blur-xl flex items-center px-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <NavLink data-testid="nav-home" to="/" end className={({isActive}) => `${linkBase} ${isActive ? "text-white" : "text-zinc-500"}`}>
        <Home size={22} /> Home
      </NavLink>
      <NavLink data-testid="nav-search" to="/search" className={({isActive}) => `${linkBase} ${isActive ? "text-white" : "text-zinc-500"}`}>
        <Search size={22} /> Search
      </NavLink>
      <button
        data-testid="nav-camera"
        onClick={() => nav("/camera")}
        className="flex-1 flex items-center justify-center"
        aria-label="AI Camera"
      >
        <span className="w-14 h-14 -translate-y-5 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.35)] active:scale-95 transition-transform">
          <Camera size={26} strokeWidth={2.2} />
        </span>
      </button>
      <NavLink data-testid="nav-notifications" to="/notifications" className={({isActive}) => `${linkBase} ${isActive ? "text-white" : "text-zinc-500"}`}>
        <Bell size={22} /> Alerts
      </NavLink>
      <NavLink
        data-testid="nav-profile"
        to={username ? `/u/${username}` : "/login"}
        className={({isActive}) => `${linkBase} ${isActive ? "text-white" : "text-zinc-500"}`}
      >
        <User size={22} /> Profile
      </NavLink>
    </nav>
  );
}
