import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { Search as SearchIcon, TrendingUp, Users } from "lucide-react";
import { mediaSrc } from "../lib/api";

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ users: [], posts: [] });
  const [suggestions, setSuggestions] = useState({ tickers: [], traders: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/search/suggestions");
        setSuggestions(data);
      } catch {}
    })();
  }, []);

  const doSearch = async (term) => {
    const v = (term ?? q).trim();
    if (!v) return;
    setQ(v);
    setHasSearched(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(v)}`);
      setRes(data);
    } catch {}
  };

  const onSubmit = (e) => {
    e.preventDefault();
    doSearch();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 px-4 py-3">
        <form onSubmit={onSubmit} className="flex items-center gap-2" data-testid="search-form">
          <SearchIcon size={18} className="text-zinc-500" />
          <input
            data-testid="search-input"
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-600"
            placeholder="Search $TICKER or trader"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); setRes({ users: [], posts: [] }); setHasSearched(false); }} className="text-zinc-500 text-xs uppercase tracking-widest">
              Clear
            </button>
          )}
        </form>
      </header>

      <main className="max-w-lg mx-auto">
        {!hasSearched && (
          <>
            {/* Suggested tickers */}
            <section className="px-4 py-5">
              <h2 className="flex items-center gap-2 text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">
                <TrendingUp size={12} /> Trending tickers
              </h2>
              <div className="flex flex-wrap gap-2">
                {suggestions.tickers.map((t) => (
                  <button
                    key={t.ticker}
                    data-testid={`suggestion-ticker-${t.ticker}`}
                    onClick={() => doSearch(t.ticker)}
                    className="px-3 py-2 border border-zinc-800 hover:border-white text-sm font-mono-tab font-bold active:scale-95 transition"
                  >
                    ${t.ticker}
                    {t.posts > 0 && <span className="ml-2 text-[10px] text-zinc-500">{t.posts}</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* Suggested traders */}
            <section className="px-4 py-5 border-t border-zinc-900">
              <h2 className="flex items-center gap-2 text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">
                <Users size={12} /> Popular traders
              </h2>
              <div className="space-y-3">
                {suggestions.traders.length === 0 && (
                  <div className="text-xs text-zinc-600">No traders yet</div>
                )}
                {suggestions.traders.map((u) => (
                  <Link key={u.user_id} to={`/u/${u.username}`} data-testid={`suggestion-trader-${u.username}`} className="flex items-center gap-3 p-2 hover:bg-zinc-950">
                    {u.avatar_url ? (
                      <img src={mediaSrc(u.avatar_url)} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-display font-black">
                        {(u.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-sm">@{u.username}</div>
                      <div className="text-xs text-zinc-500 font-mono-tab">{u.followers_count} followers</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {hasSearched && res.users?.length > 0 && (
          <section className="px-4 py-4">
            <h2 className="text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">Traders</h2>
            <div className="space-y-3">
              {res.users.map((u) => (
                <Link key={u.user_id} to={`/u/${u.username}`} data-testid={`search-user-${u.username}`} className="flex items-center gap-3 p-2 hover:bg-zinc-950">
                  {u.avatar_url ? (
                    <img src={mediaSrc(u.avatar_url)} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-display font-black">
                      {(u.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm">@{u.username}</div>
                    <div className="text-xs text-zinc-500">{u.followers_count} followers</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {hasSearched && res.posts?.length > 0 && (
          <section className="px-4 py-4">
            <h2 className="text-[11px] font-mono-tab uppercase tracking-widest text-zinc-500 mb-3">Trades</h2>
            <div className="grid grid-cols-3 gap-1">
              {res.posts.map((p) => (
                <button key={p.post_id} onClick={() => nav(`/u/${p.author?.username}`)} className="aspect-square bg-zinc-900 relative overflow-hidden" data-testid={`search-post-${p.post_id}`}>
                  {p.media_url ? (
                    <img src={mediaSrc(p.media_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-display font-black text-lg">${p.ticker}</div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {hasSearched && res.users?.length === 0 && res.posts?.length === 0 && (
          <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">
            No results for "{q}"
          </div>
        )}
      </main>
      <BottomNav username={user?.username} />
    </div>
  );
}
