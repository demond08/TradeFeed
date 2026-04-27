import React, { useState } from "react";
import { Heart, MessageCircle, Share2, CheckCircle2, XCircle } from "lucide-react";
import { api, mediaSrc } from "../lib/api";
import { Link } from "react-router-dom";

const pillClass = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-mono-tab font-bold uppercase tracking-wider";

export default function FeedPost({ post, viewerId, onChanged }) {
  const [likes, setLikes] = useState(post.likes || 0);
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [outcome, setOutcome] = useState(post.outcome || "pending");
  const isMine = viewerId && post.author?.user_id === viewerId;

  const toggleLike = async () => {
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    try { await api.post(`/posts/${post.post_id}/like`); } catch {}
  };

  const markOutcome = async (o) => {
    setOutcome(o);
    try {
      await api.post(`/posts/${post.post_id}/outcome`, { outcome: o });
      onChanged && onChanged();
    } catch {}
  };

  const isVideo = (post.media_type || "").startsWith("video");

  return (
    <article data-testid={`post-${post.post_id}`} className="border-b-4 border-zinc-950 bg-black">
      {/* Header — minimal: avatar + username + ticker pill */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link to={`/u/${post.author?.username}`} className="flex items-center gap-3 flex-1 min-w-0">
          {post.author?.avatar_url ? (
            <img src={mediaSrc(post.author.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-display font-black text-xs">
              {(post.author?.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="font-semibold text-sm truncate">@{post.author?.username}</div>
        </Link>
        <span className={`px-2 py-1 text-[11px] font-mono-tab font-bold tracking-wider ${post.side === "SHORT" ? "bg-[#FF3B30] text-white" : "bg-[#00C805] text-black"}`}>
          {post.ticker} · {post.side}
        </span>
        {outcome === "win" && (
          <span className={`${pillClass} bg-[#00C805] text-black`} data-testid="outcome-win-badge">
            <CheckCircle2 size={12} /> Win
          </span>
        )}
        {outcome === "loss" && (
          <span className={`${pillClass} bg-[#FF3B30] text-white`} data-testid="outcome-loss-badge">
            <XCircle size={12} /> Loss
          </span>
        )}
      </header>

      {/* Media */}
      {post.media_url ? (
        <div className="relative w-full bg-zinc-950 aspect-[4/5]">
          {isVideo ? (
            <video src={mediaSrc(post.media_url)} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <img src={mediaSrc(post.media_url)} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 p-3 bg-gradient-to-t from-black via-black/70 to-transparent text-xs font-mono-tab">
            <div>
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider">Entry</div>
              <div className="font-bold">{post.entry ?? "—"}</div>
            </div>
            <div>
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider">SL</div>
              <div className="font-bold text-[#FF3B30]">{post.stop_loss ?? "—"}</div>
            </div>
            <div>
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider">TP</div>
              <div className="font-bold text-[#00C805]">{post.take_profit ?? "—"}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2 text-xs font-mono-tab">
          <div><div className="text-zinc-400 text-[10px] uppercase">Entry</div><div className="font-bold">{post.entry ?? "—"}</div></div>
          <div><div className="text-zinc-400 text-[10px] uppercase">SL</div><div className="font-bold text-[#FF3B30]">{post.stop_loss ?? "—"}</div></div>
          <div><div className="text-zinc-400 text-[10px] uppercase">TP</div><div className="font-bold text-[#00C805]">{post.take_profit ?? "—"}</div></div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-5">
          <button data-testid={`like-${post.post_id}`} onClick={toggleLike} className="flex items-center gap-2 active:scale-90 transition-transform">
            <Heart size={22} className={liked ? "fill-[#FF3B30] text-[#FF3B30]" : ""} />
            <span className="text-sm font-mono-tab">{likes}</span>
          </button>
          <button className="flex items-center gap-2 text-zinc-400" aria-label="comments">
            <MessageCircle size={22} />
          </button>
          <button className="flex items-center gap-2 text-zinc-400" aria-label="share">
            <Share2 size={22} />
          </button>
        </div>
        {post.caption && <p className="text-sm leading-snug"><span className="font-bold mr-2">@{post.author?.username}</span>{post.caption}</p>}

        {isMine && outcome === "pending" && (
          <div className="flex gap-2 pt-2">
            <button
              data-testid={`mark-win-${post.post_id}`}
              onClick={() => markOutcome("win")}
              className="flex-1 py-2 bg-[#00C805] text-black font-bold text-xs uppercase tracking-widest active:scale-95"
            >
              Mark Win
            </button>
            <button
              data-testid={`mark-loss-${post.post_id}`}
              onClick={() => markOutcome("loss")}
              className="flex-1 py-2 bg-[#FF3B30] text-white font-bold text-xs uppercase tracking-widest active:scale-95"
            >
              Mark Loss
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
