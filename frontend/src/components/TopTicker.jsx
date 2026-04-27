import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function TopTicker() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/news/ticker");
        if (alive) setItems(data || []);
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const headlines = items.length ? items : [
    { headline: "MARKETS LOADING..." },
    { headline: "TRADEFEEDX // LIVE TRADE FEED FOR TRADERS" },
  ];
  const row = [...headlines, ...headlines];

  return (
    <div
      data-testid="top-ticker"
      className="fixed top-0 inset-x-0 h-8 z-50 overflow-hidden flex items-center bg-zinc-950 border-b border-zinc-800"
    >
      <div className="flex gap-12 whitespace-nowrap ticker-anim font-mono-tab text-[11px] uppercase tracking-[0.2em] text-zinc-300 px-4">
        {row.map((h, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="inline-block w-1.5 h-1.5 bg-[#00C805] rounded-full" />
            {h.headline}
          </span>
        ))}
      </div>
    </div>
  );
}
