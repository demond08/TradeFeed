import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, mediaSrc } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import { Settings as SettingsIcon, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/users/${username}`);
      setData(data);
    } catch { setData({ error: true }); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [username]);

  const toggleFollow = async () => {
    try {
      await api.post(`/users/${username}/follow`);
      load();
    } catch {}
  };

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-xs uppercase tracking-widest">Loading…</div>;
  if (data.error) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-xs uppercase">User not found</div>;

  const u = data.user;
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 flex items-center justify-between px-4 py-3">
        <button onClick={() => nav(-1)} data-testid="profile-back"><ArrowLeft /></button>
        <div className="font-display font-black text-sm">@{u.username}</div>
        {data.is_me ? (
          <Link to="/settings" data-testid="profile-settings-btn"><SettingsIcon size={20} /></Link>
        ) : <div className="w-5" />}
      </header>

      <section className="max-w-lg mx-auto p-6">
        <div className="flex items-center gap-6">
          {u.avatar_url ? (
            <img src={mediaSrc(u.avatar_url)} alt="" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center font-display font-black text-3xl">
              {(u.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 grid grid-cols-3 gap-2 text-center font-mono-tab">
            <div><div className="font-black text-lg">{data.posts.length}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Trades</div></div>
            <div><div className="font-black text-lg">{u.followers_count}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Followers</div></div>
            <div><div className="font-black text-lg">{u.following_count}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Following</div></div>
          </div>
        </div>

        <div className="mt-4">
          <div className="font-display font-bold">{u.name || u.username}</div>
          {u.bio && <p className="text-sm text-zinc-400 mt-1">{u.bio}</p>}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-6 font-mono-tab">
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-widest">Win Rate</div>
            <div className="font-black text-2xl mt-1">{data.win_rate}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-widest">Wins</div>
            <div className="font-black text-2xl text-[#00C805] mt-1">{u.wins}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-widest">Losses</div>
            <div className="font-black text-2xl text-[#FF3B30] mt-1">{u.losses}</div>
          </div>
        </div>

        {!data.is_me && (
          <button
            data-testid="follow-btn"
            onClick={toggleFollow}
            className={`mt-6 w-full py-3 uppercase font-bold tracking-widest text-sm ${data.is_following ? "border border-zinc-700" : "bg-white text-black"}`}
          >
            {data.is_following ? "Following" : "Follow"}
          </button>
        )}
      </section>

      <section className="max-w-lg mx-auto">
        <div className="grid grid-cols-3 gap-[2px] border-t border-zinc-900">
          {data.posts.map((p) => (
            <div key={p.post_id} className="aspect-square bg-zinc-950 relative overflow-hidden" data-testid={`profile-post-${p.post_id}`}>
              {p.media_url ? (
                (p.media_type === "video" ? (
                  <video src={mediaSrc(p.media_url)} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={mediaSrc(p.media_url)} alt="" className="w-full h-full object-cover" />
                ))
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display font-black text-xl">${p.ticker}</div>
              )}
              {p.outcome !== "pending" && (
                <span className={`absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 ${p.outcome === "win" ? "bg-[#00C805] text-black" : "bg-[#FF3B30] text-white"}`}>
                  {p.outcome.toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
        {data.posts.length === 0 && <div className="text-center py-20 text-zinc-600 text-xs uppercase tracking-widest">No posts yet</div>}
      </section>

      <BottomNav username={user?.username} />
    </div>
  );
}
