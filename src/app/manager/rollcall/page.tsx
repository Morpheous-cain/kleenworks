"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UserCheck, UserX, Clock, Fingerprint, RefreshCw,
  CheckCircle2, XCircle, Loader2, Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffRef { id: string; name: string; role: string }
interface LogEntry {
  id: string;
  staff_id: string;
  action: "clock-in" | "clock-out";
  source: "manual" | "fingerprint";
  created_at: string;
  staff: StaffRef | null;
}
interface StaffRow { id: string; name: string; role: string }

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

export default function RollCallPage() {
  const { toast } = useToast();
  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [allStaff,   setAllStaff]   = useState<StaffRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actionId,   setActionId]   = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const fetchLogs = useCallback(() => {
    fetch(`/api/rollcall?date=${today}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [today]);

  useEffect(() => {
    fetchLogs();
    fetch("/api/staff", { credentials: "include" })
      .then(r => r.json())
      .then(d => setAllStaff(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [fetchLogs]);

  async function clockAction(staffId: string, action: "clock-in" | "clock-out") {
    setActionId(staffId + action);
    try {
      const res = await fetch("/api/rollcall", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, action, source: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({
        title: action === "clock-in" ? "Clocked In" : "Clocked Out",
        description: data.staff?.name ?? staffId,
      });
      fetchLogs();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  }

  // Derive "last action per staff member today" for the status grid
  const lastActionByStaff: Record<string, LogEntry> = {};
  [...logs].reverse().forEach(l => {
    if (l.staff_id) lastActionByStaff[l.staff_id] = l;
  });

  const clockedIn  = Object.values(lastActionByStaff).filter(l => l.action === "clock-in").length;
  const clockedOut = Object.values(lastActionByStaff).filter(l => l.action === "clock-out").length;

  return (
    <div className="p-8 space-y-8 bg-[#f8fafc] dark:bg-[#060E1E] min-h-screen">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">
            Roll Call
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
            Staff attendance — {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}
          className="gap-2 rounded-xl h-10 bg-white dark:bg-slate-800 border-2 font-black uppercase text-[9px] tracking-widest">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Staff",  value: allStaff.length, icon: UserCheck, color: "text-slate-600",   bg: "bg-slate-100" },
          { label: "Clocked In",   value: clockedIn,       icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Clocked Out",  value: clockedOut,      icon: XCircle,   color: "text-red-500",    bg: "bg-red-50" },
        ].map((k, i) => (
          <Card key={i} className="border-none shadow-sm rounded-2xl dark:bg-[#0F1F3D]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`size-10 rounded-xl flex items-center justify-center ${k.bg}`}>
                <k.icon className={`size-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{k.label}</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Staff status grid — manual clock-in/out */}
        <Card className="border-none shadow-sm rounded-3xl dark:bg-[#0F1F3D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-black uppercase tracking-tight dark:text-white">
              Staff Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />)
            ) : allStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No staff found — add staff first.</p>
            ) : (
              allStaff.map(s => {
                const last = lastActionByStaff[s.id];
                const isIn = last?.action === "clock-in";
                const hasEntry = !!last;
                return (
                  <div key={s.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        isIn ? "bg-emerald-500" : hasEntry ? "bg-slate-400" : "bg-slate-200 !text-slate-500"
                      }`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate dark:text-white">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {last && (
                        <span className="text-[9px] text-muted-foreground font-mono">{fmt(last.created_at)}</span>
                      )}
                      {last?.source === "fingerprint" && (
                        <Fingerprint className="size-3 text-blue-400" title="Via fingerprint scanner" />
                      )}
                      {(!hasEntry || isIn) ? (
                        <Button size="sm"
                          className={cn("h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border-none",
                            isIn ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-500 text-white hover:bg-emerald-600")}
                          onClick={() => clockAction(s.id, isIn ? "clock-out" : "clock-in")}
                          disabled={actionId === s.id + (isIn ? "clock-out" : "clock-in")}>
                          {actionId === s.id + (isIn ? "clock-out" : "clock-in")
                            ? <Loader2 className="size-3 animate-spin" />
                            : isIn ? <><UserX className="size-3 mr-1" />Out</> : <><UserCheck className="size-3 mr-1" />In</>}
                        </Button>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-none text-[9px] font-black uppercase">Done</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Today's event log */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl dark:bg-[#0F1F3D]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black uppercase tracking-tight dark:text-white">
                Today&apos;s Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet today.</p>
              ) : logs.map(l => (
                <div key={l.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className={`size-6 rounded-full flex items-center justify-center shrink-0 ${
                    l.action === "clock-in" ? "bg-emerald-100" : "bg-red-100"
                  }`}>
                    {l.action === "clock-in"
                      ? <CheckCircle2 className="size-3.5 text-emerald-600" />
                      : <XCircle className="size-3.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold dark:text-white truncate">{l.staff?.name ?? "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {l.action} · {l.source === "fingerprint" ? "Fingerprint" : "Manual"}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{fmt(l.created_at)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fingerprint integration guide */}
          <Card className="border-none shadow-sm rounded-3xl border-blue-100 bg-blue-50/60 dark:bg-blue-950/20">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-5 text-blue-500" />
                <p className="text-sm font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">
                  Fingerprint Scanner Integration
                </p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Configure your scanner&apos;s controller to send a POST request to:
              </p>
              <code className="block text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg px-3 py-2 font-mono break-all">
                POST /api/rollcall<br />
                Authorization: Bearer {"<FINGERPRINT_WEBHOOK_SECRET>"}<br />
                {`{ "staff_id": "<uuid>", "action": "clock-in" }`}
              </code>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                <Wifi className="size-3" />
                Set FINGERPRINT_WEBHOOK_SECRET in Vercel env vars to activate
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                <Clock className="size-3" />
                Each staff member needs their staff table UUID mapped in the scanner
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
