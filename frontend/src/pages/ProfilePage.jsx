import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, mediaSrc } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import { Settings as SettingsIcon, ArrowLeft, Camera } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { username } = useParams();
  const { user, updateUser } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef(null);

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

  const onAvatarPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Pick an image");
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data: updated } = await api.post("/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      updateUser(updated);
      toast.success("Profile photo updated");
      load();
    } catch {
      toast.error("Upload failed");
    }
    setUploadingAvatar(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-xs">Loading…</div>;
  if (data.error) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-sm">User not found</div>;

  const u = data.user;
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-40 bg-black border-b border-zinc-900 flex items-center justify-between px-4 py-3">
        <button onClick={() => nav(-1)} data-testid="profile-back"><ArrowLeft /></button>
        <div className="font-display text-base">@{u.username}</div>
        {data.is_me ? (
          <Link to="/settings" data-testid="profile-settings-btn"><SettingsIcon size={20} /></Link>
        ) : <div className="w-5" />}
      </header>

      <section className="max-w-lg mx-auto p-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            {u.avatar_url ? (
              <img src={mediaSrc(u.avatar_url)} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center font-display text-3xl">
                {(u.username || "?")[0].toUpperCase()}
              </div>
            )}
            {data.is_me && (
              <>
                <button
                  type="button"
                  data-testid="change-avatar-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change profile photo"
                  className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 active:opacity-100 focus:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity"
                >
                  <Camera size={22} className="text-white" />
                  <span className="text-[10px] font-semibold text-white">
                    {uploadingAvatar ? "Uploading…" : "Change photo"}
                  </span>
                </button>
                <span
                  className="md:hidden absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg ring-2 ring-black"
                  aria-hidden="true"
                >
                  <Camera size={14} />
                </span>
                <input
                  ref={fileRef}
                  data-testid="change-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarPick}
                />
              </>
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center font-mono-tab">
            <div><div className="font-bold text-lg">{data.posts.length}</div><div className="text-[11px] text-zinc-500">Trades</div></div>
            <div><div className="font-bold text-lg">{u.followers_count}</div><div className="text-[11px] text-zinc-500">Followers</div></div>
            <div><div className="font-bold text-lg">{u.following_count}</div><div className="text-[11px] text-zinc-500">Following</div></div>
          </div>
        </div>

        <div className="mt-4">
          <div className="font-semibold text-base">{u.name || u.username}</div>
          {u.bio && <p className="text-sm text-zinc-400 mt-1">{u.bio}</p>}
        </div>

        <div className="mt-5 flex items-baseline gap-6 font-mono-tab">
          <div>
            <span className="font-bold text-2xl">{data.win_rate}%</span>
            <span className="ml-1.5 text-[11px] text-zinc-500">win rate</span>
          </div>
          <div>
            <span className="font-bold text-lg text-[#00C805]">{u.wins}</span>
            <span className="ml-1.5 text-[11px] text-zinc-500">W</span>
          </div>
          <div>
            <span className="font-bold text-lg text-[#FF3B30]">{u.losses}</span>
            <span className="ml-1.5 text-[11px] text-zinc-500">L</span>
          </div>
        </div>

        {!data.is_me && (
          <button
            data-testid="follow-btn"
            onClick={toggleFollow}
            className={`mt-6 w-full py-3 rounded-full font-semibold text-sm transition-colors ${data.is_following ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-white text-black hover:bg-zinc-200"}`}
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
                <div className="w-full h-full flex items-center justify-center font-display text-xl p-2 text-center">
                  {p.ticker ? `$${p.ticker}` : (p.caption || "").slice(0, 40)}
                </div>
              )}
              {p.outcome !== "pending" && (
                <span className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.outcome === "win" ? "bg-[#00C805] text-black" : "bg-[#FF3B30] text-white"}`}>
                  {p.outcome}
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
