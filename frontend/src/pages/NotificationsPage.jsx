import React from "react";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 px-4 py-3">
        <div className="font-display font-black text-sm uppercase tracking-widest">Alerts</div>
      </header>
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center pt-32 px-8 text-center">
        <Bell size={36} className="text-zinc-700 mb-4" />
        <p className="text-zinc-500 text-sm">You&apos;re all caught up. Follows, likes and outcome events will appear here.</p>
      </div>
      <BottomNav username={user?.username} />
    </div>
  );
}
