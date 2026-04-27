import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Type } from "lucide-react";
import { mediaSrc } from "../lib/api";

export default function NewPost() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [ticker, setTicker] = useState((params.get("ticker") || "").toUpperCase());
  const [side, setSide] = useState("LONG");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState(params.get("mediaUrl") || "");
  const [mediaType, setMediaType] = useState(params.get("mediaType") || "image");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTradeFields, setShowTradeFields] = useState(!!params.get("mediaUrl"));

  const analysis = (() => {
    try { return JSON.parse(params.get("analysis") || ""); } catch { return null; }
  })();

  React.useEffect(() => {
    if (analysis) {
      if (analysis.entry && !entry) setEntry(String(analysis.entry));
      if (analysis.stop_loss && !sl) setSl(String(analysis.stop_loss));
      if (analysis.take_profit && !tp) setTp(String(analysis.take_profit));
      if (analysis.side && !side) setSide(analysis.side);
      setShowTradeFields(true);
    }
    // eslint-disable-next-line
  }, []);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMediaUrl(data.url);
      setMediaType(f.type.startsWith("video") ? "video" : "image");
      setShowTradeFields(true);
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ticker.trim() && !caption.trim()) {
      return toast.error("Write something or add a ticker");
    }
    setBusy(true);
    try {
      await api.post("/posts", {
        ticker: ticker.trim(),
        side,
        entry: entry ? parseFloat(entry) : null,
        stop_loss: sl ? parseFloat(sl) : null,
        take_profit: tp ? parseFloat(tp) : null,
        caption: caption.trim(),
        media_url: mediaUrl,
        media_type: mediaUrl ? mediaType : "text",
      });
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Post failed");
    }
    setBusy(false);
  };

  const charCount = caption.length;
  const charLimit = 500;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 bg-black flex items-center justify-between px-4 py-3 border-b border-zinc-900">
        <button onClick={() => nav(-1)} data-testid="close-new"><X /></button>
        <div className="font-display font-bold text-sm">New post</div>
        <button
          data-testid="submit-post"
          form="new-post-form"
          type="submit"
          disabled={busy || (!ticker.trim() && !caption.trim())}
          className="bg-white text-black font-semibold px-4 py-1.5 text-sm rounded-full disabled:opacity-40"
        >
          {busy ? "…" : "Post"}
        </button>
      </header>

      <form id="new-post-form" onSubmit={submit} className="max-w-lg mx-auto p-4 space-y-4">
        {/* Big caption textarea — Twitter-style primary field */}
        <textarea
          data-testid="post-caption"
          autoFocus
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, charLimit))}
          placeholder="What's your take on the market?"
          rows={5}
          className="w-full bg-transparent outline-none text-[20px] font-display leading-snug placeholder:text-zinc-600 resize-none"
        />

        {/* Media preview */}
        {mediaUrl && (
          <div className="relative aspect-[4/5] bg-zinc-950">
            {mediaType === "video" ? (
              <video src={mediaSrc(mediaUrl)} className="w-full h-full object-cover" controls />
            ) : (
              <img src={mediaSrc(mediaUrl)} alt="" className="w-full h-full object-cover" />
            )}
            <button type="button" onClick={() => setMediaUrl("")} className="absolute top-2 right-2 bg-black/70 p-2 rounded-full"><X size={16} /></button>
          </div>
        )}

        {/* Action bar (upload media, add trade details) */}
        <div className="flex items-center justify-between border-t border-b border-zinc-900 py-2">
          <div className="flex items-center gap-2">
            <label data-testid="upload-media" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer px-2 py-1.5 rounded-full hover:bg-zinc-900 transition-colors">
              <ImageIcon size={18} />
              <span className="text-sm">{uploading ? "Uploading…" : "Media"}</span>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
            </label>
            <button
              type="button"
              data-testid="toggle-trade-fields"
              onClick={() => setShowTradeFields((v) => !v)}
              className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-full transition-colors ${showTradeFields ? "text-white bg-zinc-900" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}
            >
              <Type size={18} />
              <span className="text-sm">Trade</span>
            </button>
          </div>
          <div className={`text-xs font-mono-tab ${charCount > charLimit - 40 ? "text-[#FF3B30]" : "text-zinc-500"}`}>
            {charCount}/{charLimit}
          </div>
        </div>

        {showTradeFields && (
          <div className="space-y-3" data-testid="trade-fields">
            <div className="grid grid-cols-2 gap-3">
              <input
                data-testid="post-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="TICKER (optional)"
                className="bg-transparent border-0 border-b border-zinc-800 focus:border-white outline-none px-0 py-2 text-sm font-mono-tab transition-colors"
              />
              <select
                data-testid="post-side"
                value={side}
                onChange={(e) => setSide(e.target.value)}
                className="bg-transparent border-0 border-b border-zinc-800 focus:border-white outline-none px-0 py-2 text-sm font-mono-tab"
              >
                <option value="LONG" className="bg-black">LONG</option>
                <option value="SHORT" className="bg-black">SHORT</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <input data-testid="post-entry" value={entry} onChange={(e)=>setEntry(e.target.value)} placeholder="Entry" className="bg-transparent border-0 border-b border-zinc-800 focus:border-white outline-none px-0 py-2 text-sm font-mono-tab" inputMode="decimal" />
              <input data-testid="post-sl" value={sl} onChange={(e)=>setSl(e.target.value)} placeholder="SL" className="bg-transparent border-0 border-b border-zinc-800 focus:border-white outline-none px-0 py-2 text-sm font-mono-tab" inputMode="decimal" />
              <input data-testid="post-tp" value={tp} onChange={(e)=>setTp(e.target.value)} placeholder="TP" className="bg-transparent border-0 border-b border-zinc-800 focus:border-white outline-none px-0 py-2 text-sm font-mono-tab" inputMode="decimal" />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
