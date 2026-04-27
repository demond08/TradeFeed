import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
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

  const analysis = (() => {
    try { return JSON.parse(params.get("analysis") || ""); } catch { return null; }
  })();

  React.useEffect(() => {
    if (analysis) {
      if (analysis.entry && !entry) setEntry(String(analysis.entry));
      if (analysis.stop_loss && !sl) setSl(String(analysis.stop_loss));
      if (analysis.take_profit && !tp) setTp(String(analysis.take_profit));
      if (analysis.side && !side) setSide(analysis.side);
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
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ticker) return toast.error("Ticker required");
    setBusy(true);
    try {
      await api.post("/posts", {
        ticker,
        side,
        entry: entry ? parseFloat(entry) : null,
        stop_loss: sl ? parseFloat(sl) : null,
        take_profit: tp ? parseFloat(tp) : null,
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
      });
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Post failed");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between p-4 border-b border-zinc-900">
        <button onClick={() => nav(-1)} data-testid="close-new"><X /></button>
        <div className="font-display font-black text-sm uppercase tracking-widest">New Trade</div>
        <button data-testid="submit-post" form="new-post-form" type="submit" disabled={busy} className="bg-white text-black font-bold px-4 py-1.5 text-xs uppercase tracking-widest disabled:opacity-50">
          {busy ? "…" : "Post"}
        </button>
      </header>

      <form id="new-post-form" onSubmit={submit} className="max-w-lg mx-auto p-4 space-y-4">
        {mediaUrl ? (
          <div className="relative aspect-[4/5] bg-zinc-950">
            {mediaType === "video" ? (
              <video src={mediaSrc(mediaUrl)} className="w-full h-full object-cover" controls />
            ) : (
              <img src={mediaSrc(mediaUrl)} alt="" className="w-full h-full object-cover" />
            )}
            <button type="button" onClick={() => setMediaUrl("")} className="absolute top-2 right-2 bg-black/70 p-2 rounded-full"><X size={16} /></button>
          </div>
        ) : (
          <label data-testid="upload-media" className="flex flex-col items-center justify-center aspect-[4/5] border-2 border-dashed border-zinc-700 cursor-pointer hover:border-white text-zinc-500">
            <Upload size={32} />
            <span className="mt-3 text-xs uppercase tracking-widest">{uploading ? "Uploading…" : "Upload Chart / Video"}</span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <input data-testid="post-ticker" required value={ticker} onChange={(e)=>setTicker(e.target.value.toUpperCase())} placeholder="TICKER" className="bg-transparent border border-zinc-700 px-3 py-2.5 text-sm font-mono-tab" />
          <select data-testid="post-side" value={side} onChange={(e)=>setSide(e.target.value)} className="bg-transparent border border-zinc-700 px-3 py-2.5 text-sm font-mono-tab">
            <option value="LONG" className="bg-black">LONG</option>
            <option value="SHORT" className="bg-black">SHORT</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input data-testid="post-entry" value={entry} onChange={(e)=>setEntry(e.target.value)} placeholder="Entry" className="bg-transparent border border-zinc-700 px-3 py-2.5 text-sm font-mono-tab" inputMode="decimal" />
          <input data-testid="post-sl" value={sl} onChange={(e)=>setSl(e.target.value)} placeholder="SL" className="bg-transparent border border-zinc-700 px-3 py-2.5 text-sm font-mono-tab" inputMode="decimal" />
          <input data-testid="post-tp" value={tp} onChange={(e)=>setTp(e.target.value)} placeholder="TP" className="bg-transparent border border-zinc-700 px-3 py-2.5 text-sm font-mono-tab" inputMode="decimal" />
        </div>

        <textarea data-testid="post-caption" value={caption} onChange={(e)=>setCaption(e.target.value)} placeholder="Caption / thesis..." rows={3} className="w-full bg-transparent border border-zinc-700 px-3 py-2.5 text-sm" />
      </form>
    </div>
  );
}
