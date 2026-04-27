import React, { useState } from "react";
import { api } from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ users: [], posts: [] });
  const nav = useNavigate();

  const onSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setRes(data);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 px-4 py-3">
        <form onSubmit={onSearch} className="flex items-center gap-2" data-testid="search-form">
          <SearchIcon size={18} className="text-zinc-500" />
          <input
            data-testid="search-input"
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-600"
            placeholder="Search $TICKER or trader"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
      </header>
      <main className="max-w-lg mx-auto">
        {res.users?.length > 0 && (
          <section className="px-4 py-4">
            <h2 className="text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">Traders</h2>
            <div className="space-y-3">
              {res.users.map((u) => (
                <Link key={u.user_id} to={`/u/${u.username}`} data-testid={`search-user-${u.username}`} className="flex items-center gap-3 p-2 hover:bg-zinc-950">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-display font-black">
                    {(u.username || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm">@{u.username}</div>
                    <div className="text-xs text-zinc-500">{u.followers_count} followers</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {res.posts?.length > 0 && (
          <section className="px-4 py-4">
            <h2 className="text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">Trades</h2>
            <div className="grid grid-cols-3 gap-1">
              {res.posts.map((p) => (
                <button key={p.post_id} onClick={() => nav("/")} className="aspect-square bg-zinc-900 relative overflow-hidden" data-testid={`search-post-${p.post_id}`}>
                  <div className="absolute inset-0 flex items-center justify-center font-display font-black text-lg">${p.ticker}</div>
                </button>
              ))}
            </div>
          </section>
        )}
        {res.users?.length === 0 && res.posts?.length === 0 && (
          <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">
            {q ? "No results" : "Search tickers or traders"}
          </div>
        )}
      </main>
      <BottomNav username={user?.username} />
    </div>
  );
}
