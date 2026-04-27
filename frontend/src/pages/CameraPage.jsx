import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import {
  Camera as CamIcon,
  X,
  Sparkles,
  Zap,
  ZapOff,
  RotateCcw,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const MODES = [
  { key: "photo", label: "Photo" },
  { key: "video", label: "Video" },
  { key: "ai", label: "AI Chart" },
];

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export default function CameraPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(null);
  const recordTimerRef = useRef(null);
  const flashLayerRef = useRef(null);
  const galleryInputRef = useRef(null);
  const nav = useNavigate();

  const [mode, setMode] = useState("photo");
  const [facing, setFacing] = useState("environment");
  const [flash, setFlash] = useState(false); // soft-flash only (screen flash on capture)
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedVideo, setCapturedVideo] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [ticker, setTicker] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Attach camera stream. Re-run when facing changes.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        toast.error("Camera access denied");
      }
    };
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing, mode]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      recordStartRef.current = Date.now();
      recordTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
    } else {
      clearInterval(recordTimerRef.current);
      setElapsed(0);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [recording]);

  const doFlash = () => {
    if (!flash || !flashLayerRef.current) return;
    const el = flashLayerRef.current;
    el.style.opacity = "1";
    setTimeout(() => { el.style.opacity = "0"; }, 140);
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    doFlash();
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1080;
    c.height = v.videoHeight || 1920;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    if (mode === "ai") {
      // immediately analyze
      setTimeout(() => analyze(dataUrl), 50);
    }
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

  const analyze = async (imgDataUrl) => {
    const src = imgDataUrl || capturedImage;
    if (!src) return;
    setAnalyzing(true);
    setAnalysis(null);
    setSheetOpen(true);
    try {
      const b64 = src.split(",")[1];
      const { data } = await api.post("/ai/analyze-trade", { image_base64: b64, ticker });
      setAnalysis(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI analysis failed");
      setSheetOpen(false);
    }
    setAnalyzing(false);
  };

  const importGallery = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video");
    if (isVideo) {
      setCapturedVideo(f);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedImage(reader.result);
        if (mode === "ai") setTimeout(() => analyze(reader.result), 50);
      };
      reader.readAsDataURL(f);
    }
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
      const analysisParam = analysis ? encodeURIComponent(JSON.stringify(analysis)) : "";
      nav(`/new?mediaUrl=${encodeURIComponent(up.url)}&mediaType=${mediaType}&ticker=${encodeURIComponent(ticker)}&analysis=${analysisParam}`);
    } catch {
      toast.error("Upload failed");
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    setAnalysis(null);
    setSheetOpen(false);
  };

  const hasCapture = capturedImage || capturedVideo;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none">
      {/* Viewfinder */}
      <div className="absolute inset-0">
        {!hasCapture ? (
          <video
            ref={videoRef}
            data-testid="camera-video"
            muted
            playsInline
            className={`w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
          />
        ) : capturedVideo ? (
          <video src={URL.createObjectURL(capturedVideo)} controls className="w-full h-full object-contain bg-black" />
        ) : (
          <img src={capturedImage} alt="" className="w-full h-full object-contain bg-black" />
        )}
        {/* Screen-flash layer */}
        <div
          ref={flashLayerRef}
          className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-150"
          style={{ opacity: 0 }}
        />
        {/* AI framing guide (only in AI mode, no outline boxes anywhere else) */}
        {!hasCapture && mode === "ai" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[82%] aspect-[4/3] rounded-2xl border-2 border-dashed border-white/60" />
            <span className="absolute top-[14%] text-[11px] text-white/80 font-semibold bg-black/40 px-2.5 py-1 rounded-full">
              Place chart inside the frame
            </span>
          </div>
        )}
      </div>

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={() => nav(-1)} data-testid="close-camera" className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center active:scale-90">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          {recording ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF3B30] font-mono-tab text-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {formatTime(elapsed)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            data-testid="flash-btn"
            onClick={() => setFlash((v) => !v)}
            aria-label="Toggle flash"
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 ${flash ? "bg-white text-black" : "bg-black/40"}`}
          >
            {flash ? <Zap size={18} /> : <ZapOff size={18} />}
          </button>
          <button
            data-testid="flip-cam-btn"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            aria-label="Flip camera"
            className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center active:scale-90"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {/* Ticker input (AI mode, pre-capture) */}
      {!hasCapture && mode === "ai" && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <input
            data-testid="camera-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="$TICKER"
            className="w-36 text-center bg-black/50 backdrop-blur px-3 py-2 rounded-full text-sm font-semibold outline-none placeholder:text-white/60"
          />
        </div>
      )}

      {/* Bottom controls */}
      {!hasCapture ? (
        <div className="absolute bottom-0 inset-x-0 z-20 pb-8 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          {/* Mode pills */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {MODES.map((m) => (
              <button
                key={m.key}
                data-testid={`mode-${m.key}`}
                onClick={() => { setMode(m.key); setCapturedImage(null); setCapturedVideo(null); setAnalysis(null); }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  mode === m.key ? "bg-white text-black" : "bg-black/40 text-white/80"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Shutter row */}
          <div className="flex items-center justify-around px-8">
            {/* Gallery */}
            <button
              data-testid="gallery-btn"
              aria-label="Pick from gallery"
              onClick={() => galleryInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center active:scale-90"
            >
              <ImageIcon size={20} />
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept={mode === "video" ? "video/*" : "image/*"}
              className="hidden"
              onChange={importGallery}
            />

            {/* Big shutter — Instagram-style ring + inner dot */}
            {mode === "video" ? (
              recording ? (
                <button
                  data-testid="rec-stop"
                  onClick={stopRec}
                  aria-label="Stop recording"
                  className="relative w-20 h-20 flex items-center justify-center"
                >
                  <span className="absolute inset-0 rounded-full border-4 border-[#FF3B30] animate-pulse" />
                  <span className="w-7 h-7 bg-[#FF3B30] rounded-md" />
                </button>
              ) : (
                <button
                  data-testid="rec-start"
                  onClick={startRec}
                  aria-label="Start recording"
                  className="relative w-20 h-20 flex items-center justify-center active:scale-95"
                >
                  <span className="absolute inset-0 rounded-full border-4 border-white" />
                  <span className="w-14 h-14 bg-[#FF3B30] rounded-full" />
                </button>
              )
            ) : (
              <button
                data-testid="snap-btn"
                onClick={snap}
                aria-label="Take photo"
                className="relative w-20 h-20 flex items-center justify-center active:scale-95"
              >
                <span className="absolute inset-0 rounded-full border-4 border-white" />
                <span className="w-16 h-16 bg-white rounded-full" />
              </button>
            )}

            {/* Camera flip mirror on right */}
            <button
              data-testid="flip-cam-btn-bottom"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              aria-label="Flip"
              className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center active:scale-90"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      ) : (
        // Post-capture action bar
        <div className="absolute bottom-0 inset-x-0 z-20 pb-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
          <div className="px-5 flex flex-col gap-3 max-w-md mx-auto">
            {capturedImage && !analysis && mode !== "ai" && (
              <button
                data-testid="ai-analyze-btn"
                onClick={() => analyze()}
                disabled={analyzing}
                className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Sparkles size={16} />
                {analyzing ? "Analyzing…" : "Analyze with AI"}
              </button>
            )}
            <div className="flex gap-3">
              <button
                data-testid="reset-cam"
                onClick={reset}
                className="flex-1 py-3 rounded-full bg-zinc-800 text-sm font-semibold"
              >
                Retake
              </button>
              <button
                data-testid="post-capture"
                onClick={uploadAndPost}
                className="flex-1 py-3 rounded-full bg-[#00C805] text-black font-semibold text-sm"
              >
                Use &amp; Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI analysis bottom sheet — no outline box */}
      {sheetOpen && (capturedImage || analyzing) && (
        <div
          data-testid="ai-sheet"
          className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-zinc-950/95 backdrop-blur-xl max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-xl flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span className="font-semibold text-sm">AI analysis</span>
              {analysis?.verdict && (
                <span className={`ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  analysis.verdict === "GOOD" ? "bg-[#00C805] text-black"
                  : analysis.verdict === "BAD" ? "bg-[#FF3B30]" : "bg-zinc-700"
                }`}>
                  {analysis.verdict} · {analysis.confidence}%
                </span>
              )}
            </div>
            <button
              data-testid="ai-sheet-close"
              onClick={() => setSheetOpen(false)}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="px-5 pb-8 space-y-4 text-sm">
            {analyzing && !analysis && (
              <div className="flex items-center gap-3 text-zinc-400">
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Reading the chart with Gemini Vision…
              </div>
            )}

            {analysis && (
              <>
                <div className="flex flex-wrap gap-2 font-mono-tab text-[11px]">
                  {analysis.side && <span className="px-2.5 py-1 bg-zinc-800 rounded-full">{analysis.side}</span>}
                  {analysis.timeframe && <span className="px-2.5 py-1 bg-zinc-800 rounded-full">{analysis.timeframe}</span>}
                  {analysis.trend && <span className="px-2.5 py-1 bg-zinc-800 rounded-full">{analysis.trend}</span>}
                  {analysis.pattern && <span className="px-2.5 py-1 bg-zinc-800 rounded-full">{analysis.pattern}</span>}
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono-tab text-xs">
                  <div>
                    <div className="text-zinc-500 text-[11px]">Entry</div>
                    <div className="font-semibold text-base">{analysis.entry ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[11px]">Stop</div>
                    <div className="font-semibold text-base text-[#FF3B30]">{analysis.stop_loss ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[11px]">Target</div>
                    <div className="font-semibold text-base text-[#00C805]">{analysis.take_profit ?? "—"}</div>
                  </div>
                </div>

                {(analysis.risk_reward || (analysis.targets && analysis.targets.length > 0)) && (
                  <div className="grid grid-cols-2 gap-2 font-mono-tab text-xs">
                    <div>
                      <div className="text-zinc-500 text-[11px]">R : R</div>
                      <div className="font-semibold">{analysis.risk_reward ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-[11px]">Targets</div>
                      <div className="font-semibold">{(analysis.targets || []).join(", ") || "—"}</div>
                    </div>
                  </div>
                )}

                {analysis.key_levels && (analysis.key_levels.support?.length || analysis.key_levels.resistance?.length) ? (
                  <div className="grid grid-cols-2 gap-2 font-mono-tab text-xs">
                    <div>
                      <div className="text-zinc-500 text-[11px]">Support</div>
                      <div className="font-semibold text-[#00C805]">{(analysis.key_levels.support || []).join(" · ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-[11px]">Resistance</div>
                      <div className="font-semibold text-[#FF3B30]">{(analysis.key_levels.resistance || []).join(" · ") || "—"}</div>
                    </div>
                  </div>
                ) : null}

                {analysis.indicators && (
                  <div>
                    <div className="text-zinc-500 text-[11px]">Indicators</div>
                    <div className="text-zinc-200">{analysis.indicators}</div>
                  </div>
                )}

                {analysis.entry_reasoning && (
                  <div>
                    <div className="text-zinc-500 text-[11px]">Why</div>
                    <p className="text-zinc-200 leading-snug">{analysis.entry_reasoning}</p>
                  </div>
                )}

                {analysis.risks && (
                  <div>
                    <div className="text-[#FF3B30] text-[11px]">Risks</div>
                    <p className="text-zinc-200 leading-snug">{analysis.risks}</p>
                  </div>
                )}

                {analysis.alt_scenario && (
                  <div>
                    <div className="text-zinc-500 text-[11px]">Alt scenario</div>
                    <p className="text-zinc-200 leading-snug">{analysis.alt_scenario}</p>
                  </div>
                )}

                {analysis.rationale && (
                  <p className="text-xs text-zinc-400 leading-snug pt-2">
                    {analysis.rationale}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav username={user?.username} />
    </div>
  );
}
