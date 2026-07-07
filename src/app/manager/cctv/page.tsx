"use client";

// src/app/manager/cctv/page.tsx
//
// Preview-only for now — no camera/NVR integration exists yet. Mirrors
// the layout convention used by Logistics: real bays/services pulled
// from the API where possible (so the camera grid reflects the actual
// branch layout), with a ComingSoonBanner making clear the video feed
// itself is a placeholder, not live footage.

import { useEffect, useState } from "react";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Maximize2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Bay {
  id: string;
  name: string;
  status: string;
}

export default function CCTVPage() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bays", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBays(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // One camera per bay, plus a fixed entrance/exit camera every site has
  const cameraFeeds = [
    { id: "entrance", label: "Entrance Gate", online: true },
    ...bays.map((b) => ({ id: b.id, label: b.name, online: true })),
    { id: "exit", label: "Exit Gate", online: true },
  ];

  return (
    <div className="p-8 space-y-8 bg-[#f8fafc] dark:bg-[#060E1E] min-h-screen">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">
            CCTV Monitoring
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
            Live site surveillance — bay cameras, entrance &amp; exit
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl h-10 gap-2 bg-white dark:bg-slate-800 border-2 font-black uppercase text-[9px] tracking-widest"
        >
          <RefreshCw className="size-3.5" /> Refresh Feeds
        </Button>
      </header>

      <ComingSoonBanner
        feature="CCTV Monitoring"
        detail="Camera tiles below mirror your real bay layout, but the video feed itself is a placeholder — connecting your DVR/NVR is the next step."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-56 bg-white dark:bg-slate-800 rounded-3xl animate-pulse" />
          ))
        ) : (
          cameraFeeds.map((cam) => (
            <Card
              key={cam.id}
              className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-[#0F1F3D] group"
            >
              {/* Feed placeholder */}
              <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-90" />
                <Video className="size-10 text-white/15 relative z-10" />

                {/* Live badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Live</span>
                </div>

                {/* Connection status */}
                <div className="absolute top-3 right-3">
                  {cam.online ? (
                    <Wifi className="size-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="size-3.5 text-red-400" />
                  )}
                </div>

                {/* Expand button (visual only for now) */}
                <button className="absolute bottom-3 right-3 size-8 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="size-3.5" />
                </button>
              </div>

              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {cam.label}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Camera #{cam.id.slice(0, 6)}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "font-black text-[8px] uppercase px-2.5 py-1 border-none",
                    cam.online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {cam.online ? "Online" : "Offline"}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
