import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import FeedPost from "../components/FeedPost";
import TopTicker from "../components/TopTicker";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Plus, Search as SearchIcon } from "lucide-react";

const TABS = [
  { key: "foryou", label: "For You" },
  { key: "trending", label: "Trending" },
  { key: "news", label: "News" },
  { key: "following", label: "Following" },
];

export default function Feed() {
  const { user } = useAuth();
  const [tab, setTab] = useState("foryou");
  const [posts, setPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "news") {
        const { data } = await api.get("/news");
        setNews(data || []);
      } else {
        const { data } = await api.get(`/posts/feed?tab=${tab}`);
        setPosts(data || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  return (
    <div className="min-h-screen bg-black text-white">
      <TopTicker />

      {/* Header */}
      <header className="fixed top-8 inset-x-0 z-40 bg-black/90 backdrop-blur-xl border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <h1 className="font-display font-black text-xl tracking-tighter">TRADEFEEDX</h1>
          <Link to="/search" data-testid="header-search" className="p-2 rounded-full hover:bg-zinc-900">
            <SearchIcon size={20} />
          </Link>
        </div>
        <div className="flex gap-5 px-4 max-w-lg mx-auto overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key ? "border-white text-white" : "border-transparent text-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto pt-[7.5rem] pb-24">
        {/* Twitter-style compose bar */}
        {tab !== "news" && user && (
          <Link
            to="/new"
            data-testid="compose-bar"
            className="flex items-center gap-3 px-4 py-3 border-b border-zinc-900 hover:bg-zinc-950 active:bg-zinc-900 transition-colors"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-display font-bold text-sm">
                {(user.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-zinc-500 text-[15px] font-display">What&apos;s your trade idea?</div>
            <span className="text-xs font-bold uppercase tracking-widest bg-white text-black px-3 py-1.5">Post</span>
          </Link>
        )}

        {loading && <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">Loading…</div>}

        {!loading && tab === "news" && (
          <div className="divide-y divide-zinc-900">
            {news.length === 0 && <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">No news yet</div>}
            {news.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="flex gap-3 p-4 hover:bg-zinc-950" data-testid={`news-${n.id}`}>
                {n.image && <img src={n.image} alt="" className="w-20 h-20 object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono-tab text-zinc-500 uppercase tracking-widest mb-1">{n.source}</div>
                  <div className="text-sm font-semibold leading-tight">{n.headline}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {!loading && tab !== "news" && (
          <>
            {posts.length === 0 ? (
              <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">
                {tab === "following" ? "Follow traders to see their posts" : "No posts yet — be the first"}
              </div>
            ) : posts.map((p) => (
              <FeedPost key={p.post_id} post={p} viewerId={user?.user_id} onChanged={load} />
            ))}
          </>
        )}
      </main>

      <Link
        to="/new"
        data-testid="new-post-fab"
        className="fixed right-4 bottom-24 z-40 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg active:scale-95"
      >
        <Plus size={22} />
      </Link>

      <BottomNav username={user?.username} />
    </div>
  );
}
