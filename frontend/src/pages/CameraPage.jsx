import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import { Camera as CamIcon, Circle, Square, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function CameraPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const nav = useNavigate();

  const [recording, setRecording] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null); // dataURL
  const [capturedVideo, setCapturedVideo] = useState(null); // blob
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [ticker, setTicker] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        toast.error("Camera access denied or unavailable");
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720;
    c.height = v.videoHeight || 1280;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setCapturedVideo(blob);
    };
    mr.start();
    recorderRef.current = mr;
    setRecording(true);
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const analyze = async () => {
    if (!capturedImage) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const b64 = capturedImage.split(",")[1];
      const { data } = await api.post("/ai/analyze-trade", { image_base64: b64, ticker });
      setAnalysis(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI analysis failed");
    }
    setAnalyzing(false);
  };

  const uploadAndPost = async () => {
    let blob;
    let ext = "jpg";
    let mediaType = "image";
    if (capturedVideo) { blob = capturedVideo; ext = "webm"; mediaType = "video"; }
    else if (capturedImage) {
      const r = await fetch(capturedImage);
      blob = await r.blob();
    } else return;

    const fd = new FormData();
    fd.append("file", blob, `capture.${ext}`);
    try {
      const { data: up } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Go to new post page with prefilled data
      const analysisParam = analysis ? encodeURIComponent(JSON.stringify(analysis)) : "";
      nav(`/new?mediaUrl=${encodeURIComponent(up.url)}&mediaType=${mediaType}&ticker=${encodeURIComponent(ticker)}&analysis=${analysisParam}`);
    } catch (e) {
      toast.error("Upload failed");
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    setAnalysis(null);
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      <header className="fixed top-0 inset-x-0 z-40 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => nav(-1)} data-testid="close-camera" className="p-2"><X /></button>
        <div className="font-display font-black text-sm">AI TRADE CAM</div>
        <div className="w-9" />
      </header>

      <div className="relative w-full h-screen bg-zinc-950 flex items-center justify-center overflow-hidden">
        {!capturedImage && !capturedVideo ? (
          <video ref={videoRef} data-testid="camera-video" muted playsInline className="w-full h-full object-cover" />
        ) : capturedVideo ? (
          <video src={URL.createObjectURL(capturedVideo)} controls className="w-full h-full object-cover" />
        ) : (
          <img src={capturedImage} alt="" className="w-full h-full object-contain" />
        )}

        {/* Ticker input */}
        {!capturedVideo && (
          <div className="absolute top-20 inset-x-4">
            <input
              data-testid="camera-ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="$TICKER"
              className="w-32 bg-black/60 border border-white/40 px-3 py-2 text-sm font-mono-tab outline-none"
            />
          </div>
        )}

        {/* AI analysis overlay */}
        {analysis && (
          <div data-testid="ai-analysis" className="absolute inset-x-4 top-36 bottom-44 overflow-y-auto p-4 bg-black/85 backdrop-blur border border-white/20 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span className="font-display font-black uppercase tracking-widest">AI Verdict</span>
              <span className={`ml-auto px-2 py-0.5 text-xs font-bold ${analysis.verdict === "GOOD" ? "bg-[#00C805] text-black" : analysis.verdict === "BAD" ? "bg-[#FF3B30]" : "bg-zinc-700"}`}>
                {analysis.verdict} · {analysis.confidence}%
              </span>
            </div>

            <div className="flex flex-wrap gap-2 font-mono-tab text-[11px] uppercase tracking-widest">
              {analysis.side && <span className="px-2 py-1 border border-zinc-700">{analysis.side}</span>}
              {analysis.timeframe && <span className="px-2 py-1 border border-zinc-700">{analysis.timeframe}</span>}
              {analysis.trend && <span className="px-2 py-1 border border-zinc-700">{analysis.trend}</span>}
              {analysis.pattern && <span className="px-2 py-1 border border-zinc-700">{analysis.pattern}</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono-tab text-xs">
              <div><div className="text-zinc-500 uppercase text-[10px]">Entry</div><div className="font-bold">{analysis.entry ?? "—"}</div></div>
              <div><div className="text-zinc-500 uppercase text-[10px]">SL</div><div className="font-bold text-[#FF3B30]">{analysis.stop_loss ?? "—"}</div></div>
              <div><div className="text-zinc-500 uppercase text-[10px]">TP</div><div className="font-bold text-[#00C805]">{analysis.take_profit ?? "—"}</div></div>
            </div>

            {(analysis.risk_reward || (analysis.targets && analysis.targets.length > 0)) && (
              <div className="grid grid-cols-2 gap-2 font-mono-tab text-xs">
                <div><div className="text-zinc-500 uppercase text-[10px]">R:R</div><div className="font-bold">{analysis.risk_reward ?? "—"}</div></div>
                <div><div className="text-zinc-500 uppercase text-[10px]">Targets</div><div className="font-bold">{(analysis.targets || []).join(", ") || "—"}</div></div>
              </div>
            )}

            {analysis.key_levels && (analysis.key_levels.support?.length || analysis.key_levels.resistance?.length) ? (
              <div className="grid grid-cols-2 gap-2 font-mono-tab text-xs">
                <div>
                  <div className="text-zinc-500 uppercase text-[10px]">Support</div>
                  <div className="font-bold text-[#00C805]">{(analysis.key_levels.support || []).join(" · ") || "—"}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase text-[10px]">Resistance</div>
                  <div className="font-bold text-[#FF3B30]">{(analysis.key_levels.resistance || []).join(" · ") || "—"}</div>
                </div>
              </div>
            ) : null}

            {analysis.indicators && (
              <div className="text-xs">
                <div className="text-zinc-500 uppercase text-[10px] tracking-widest">Indicators</div>
                <div className="text-zinc-200">{analysis.indicators}</div>
              </div>
            )}

            {analysis.entry_reasoning && (
              <div className="text-xs">
                <div className="text-zinc-500 uppercase text-[10px] tracking-widest">Why</div>
                <p className="text-zinc-200 leading-snug">{analysis.entry_reasoning}</p>
              </div>
            )}

            {analysis.risks && (
              <div className="text-xs">
                <div className="text-[#FF3B30] uppercase text-[10px] tracking-widest">Risks</div>
                <p className="text-zinc-200 leading-snug">{analysis.risks}</p>
              </div>
            )}

            {analysis.alt_scenario && (
              <div className="text-xs">
                <div className="text-zinc-500 uppercase text-[10px] tracking-widest">Alt scenario</div>
                <p className="text-zinc-200 leading-snug">{analysis.alt_scenario}</p>
              </div>
            )}

            {analysis.rationale && (
              <p className="text-xs text-zinc-400 leading-snug border-t border-zinc-800 pt-2">{analysis.rationale}</p>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-28 inset-x-0 flex items-center justify-center gap-6">
          {!capturedImage && !capturedVideo && (
            <>
              <button data-testid="snap-btn" onClick={snap} className="w-16 h-16 rounded-full bg-white active:scale-90 flex items-center justify-center">
                <CamIcon className="text-black" />
              </button>
              {!recording ? (
                <button data-testid="rec-start" onClick={startRec} className="w-14 h-14 rounded-full border-4 border-[#FF3B30] flex items-center justify-center active:scale-90">
                  <Circle size={18} className="fill-[#FF3B30] text-[#FF3B30]" />
                </button>
              ) : (
                <button data-testid="rec-stop" onClick={stopRec} className="w-14 h-14 rounded-full border-4 border-[#FF3B30] flex items-center justify-center active:scale-90 animate-pulse">
                  <Square size={18} className="fill-[#FF3B30] text-[#FF3B30]" />
                </button>
              )}
            </>
          )}

          {(capturedImage || capturedVideo) && (
            <div className="flex flex-col gap-3 w-full max-w-sm px-4">
              <div className="flex gap-3">
                <button data-testid="reset-cam" onClick={reset} className="flex-1 py-3 border border-zinc-700 text-sm uppercase tracking-widest font-bold">Retake</button>
                {capturedImage && !analysis && (
                  <button data-testid="ai-analyze-btn" onClick={analyze} disabled={analyzing} className="flex-1 py-3 bg-white text-black text-sm uppercase tracking-widest font-bold active:scale-95">
                    {analyzing ? "…" : "Analyze with AI"}
                  </button>
                )}
              </div>
              <button data-testid="post-capture" onClick={uploadAndPost} className="w-full py-3 bg-[#00C805] text-black text-sm uppercase tracking-widest font-black active:scale-95">
                Use & Post
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav username={user?.username} />
    </div>
  );
}
