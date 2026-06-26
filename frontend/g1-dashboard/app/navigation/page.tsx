"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Location {
  primary_name: string;
  aliases: string[];
  api_id: number;
  all_names: string[];
}

interface NavStatus {
  robot_agent_reachable: boolean;
  robot_agent_host: string;
  robot_agent_port: number;
  locations_count: number;
  locations: string[];
}

interface Log {
  ts: string;
  msg: string;
  type: "success" | "error" | "info";
}

const SLAM_COMMANDS = [
  { key: "start_mapping",  label: "START MAPPING",   desc: "Begin LiDAR scan — move robot through area", color: "text-green-400 border-green-400/40 hover:bg-green-400/10" },
  { key: "end_mapping",    label: "END MAPPING",     desc: "Save map to .pcd file (min 15s of mapping)", color: "text-blue-400 border-blue-400/40 hover:bg-blue-400/10" },
  { key: "relocation",     label: "RELOCATION",      desc: "Localize robot on existing map",              color: "text-purple-400 border-purple-400/40 hover:bg-purple-400/10" },
  { key: "map_sequence_1", label: "MAP SEQ 1",       desc: "Run full route (map_sequence.yaml)",          color: "text-cyan-400 border-cyan-400/40 hover:bg-cyan-400/10" },
  { key: "map_sequence_2", label: "MAP SEQ 2",       desc: "Run alternate route (map_sequence_2.yaml)",   color: "text-cyan-400 border-cyan-400/40 hover:bg-cyan-400/10" },
];

const NAV_CONTROLS = [
  { key: "pause",  label: "PAUSE",  color: "text-yellow-400 border-yellow-400/40 hover:bg-yellow-400/10" },
  { key: "resume", label: "RESUME", color: "text-green-400 border-green-400/40 hover:bg-green-400/10" },
  { key: "abort",  label: "ABORT",  color: "text-red-400 border-red-400/40 hover:bg-red-400/10" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NavigationPage() {
  const [status, setStatus] = useState<NavStatus | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [slamBusy, setSlamBusy] = useState<string | null>(null);

  // Add location form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newApiId, setNewApiId] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // ── Log helper ──────────────────────────────────────────────────────────────

  const addLog = useCallback((msg: string, type: Log["type"] = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [{ ts, msg, type }, ...prev].slice(0, 50));
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/navigation/status`);
      if (r.ok) setStatus(await r.json());
    } catch { /* offline */ }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const r = await fetch(`${API}/navigation/locations`);
      if (r.ok) {
        const d = await r.json();
        setLocations(d.locations ?? []);
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLocations();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchLocations]);

  // ── Navigate to location ────────────────────────────────────────────────────

  async function handleNavigate(locationName: string) {
    setNavigating(locationName);
    addLog(`Navigating to '${locationName}'...`, "info");
    try {
      const r = await fetch(`${API}/navigation/go`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: locationName }),
      });
      const d = await r.json();
      if (r.ok) {
        addLog(`✓ Navigation to '${locationName}' started (api_id=${d.api_id})`, "success");
      } else {
        addLog(`✗ ${d.detail ?? "Navigation failed"}`, "error");
      }
    } catch (e) {
      addLog(`✗ Cannot reach backend`, "error");
    } finally {
      setNavigating(null);
    }
  }

  // ── SLAM command ────────────────────────────────────────────────────────────

  async function handleSlam(command: string) {
    setSlamBusy(command);
    addLog(`SLAM: ${command}...`, "info");
    try {
      const r = await fetch(`${API}/navigation/slam/${command}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        addLog(`✓ SLAM '${command}' sent (api_id=${d.api_id})`, "success");
      } else {
        addLog(`✗ ${d.detail ?? "SLAM command failed"}`, "error");
      }
    } catch {
      addLog(`✗ Cannot reach backend`, "error");
    } finally {
      setSlamBusy(null);
    }
  }

  // ── Nav controls (pause/resume/abort) ───────────────────────────────────────

  async function handleNavControl(command: string) {
    addLog(`Nav control: ${command}`, "info");
    await handleSlam(command);
  }

  // ── Add location ────────────────────────────────────────────────────────────

  async function handleAddLocation() {
    if (!newName.trim() || !newApiId.trim()) return;
    setAddLoading(true);
    try {
      const aliases = newAliases.split(",").map(s => s.trim()).filter(Boolean);
      const r = await fetch(`${API}/navigation/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    newName.trim().toLowerCase(),
          api_id:  parseInt(newApiId),
          aliases,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        addLog(`✓ Location '${newName}' added (api_id=${d.api_id})`, "success");
        setNewName(""); setNewApiId(""); setNewAliases("");
        setShowAddForm(false);
        fetchLocations();
        fetchStatus();
      } else {
        addLog(`✗ ${d.detail ?? "Failed to add location"}`, "error");
      }
    } catch {
      addLog("✗ Cannot reach backend", "error");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteLocation(name: string) {
    if (!confirm(`Remove location '${name}' and all its aliases?`)) return;
    try {
      const r = await fetch(`${API}/navigation/locations/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (r.ok) {
        addLog(`✓ Removed: ${d.removed?.join(", ")}`, "success");
        fetchLocations();
        fetchStatus();
      } else {
        addLog(`✗ ${d.detail}`, "error");
      }
    } catch {
      addLog("✗ Cannot reach backend", "error");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">

      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Navigation
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Indoor SLAM navigation and mapping control
        </p>
      </div>

      {/* [01] System Status */}
      <section id="status" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <span className="text-primary font-mono text-sm">[01]</span>
            <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">system status</h2>
          </div>
          <button
            onClick={() => { fetchStatus(); fetchLocations(); }}
            className="px-3 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-primary hover:text-primary transition-colors"
          >
            REFRESH
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-border bg-card/50 p-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// robot_agent</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status?.robot_agent_reachable ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <p className={`font-mono text-lg font-bold uppercase ${status?.robot_agent_reachable ? "text-green-400" : "text-red-400"}`}>
                {status ? (status.robot_agent_reachable ? "ONLINE" : "OFFLINE") : "CHECKING"}
              </p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              {status?.robot_agent_host}:{status?.robot_agent_port}
            </p>
          </div>

          <div className="border border-border bg-card/50 p-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// locations</p>
            <p className="font-mono text-3xl font-bold text-primary">{status?.locations_count ?? "—"}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">mapped destinations</p>
          </div>

          <div className="border border-border bg-card/50 p-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// dds topic</p>
            <p className="font-mono text-xs text-foreground break-all">rt/drex_slam_remote</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">keyDemo bridge active</p>
          </div>
        </div>
      </section>

      {/* [02] Navigation Controls */}
      <section id="navigate" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[02]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">navigate to location</h2>
        </div>

        {/* Pause / Resume / Abort bar */}
        <div className="flex items-center gap-3 mb-6 border border-border bg-card/30 p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase mr-2">Active nav:</p>
          {NAV_CONTROLS.map(ctrl => (
            <button
              key={ctrl.key}
              onClick={() => handleNavControl(ctrl.key)}
              disabled={slamBusy === ctrl.key}
              className={`px-4 py-2 border font-mono text-xs uppercase transition-colors disabled:opacity-40 ${ctrl.color}`}
            >
              {slamBusy === ctrl.key ? "..." : ctrl.label}
            </button>
          ))}
        </div>

        {locations.length === 0 ? (
          <div className="border border-border bg-card/20 p-8 flex items-center justify-center">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              [ No locations configured — add one below ]
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(loc => (
              <div key={loc.api_id} className="border border-border bg-card/50 p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground uppercase">{loc.primary_name}</p>
                    {loc.aliases.length > 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        alias: {loc.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-primary border border-primary/30 px-1.5 py-0.5">
                      {loc.api_id}
                    </span>
                    <button
                      onClick={() => handleDeleteLocation(loc.primary_name)}
                      className="font-mono text-[10px] text-red-400/50 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleNavigate(loc.primary_name)}
                  disabled={navigating !== null || !status?.robot_agent_reachable}
                  className="w-full border border-primary/40 text-primary font-mono text-xs uppercase py-2 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {navigating === loc.primary_name ? "[ NAVIGATING... ]" : "[ NAVIGATE ]"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add location form */}
        <div className="mt-6">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="border border-dashed border-border text-muted-foreground font-mono text-xs uppercase px-6 py-3 hover:border-primary hover:text-primary transition-colors w-full"
            >
              + ADD LOCATION
            </button>
          ) : (
            <div className="border border-border bg-card/30 p-5 space-y-4">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">// new location</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[10px] text-muted-foreground uppercase mb-1.5">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. lab"
                    className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-muted-foreground uppercase mb-1.5">
                    API ID (1301-1399 or 1401-1430)
                  </label>
                  <input
                    type="number"
                    value={newApiId}
                    onChange={e => setNewApiId(e.target.value)}
                    placeholder="e.g. 1401"
                    className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-muted-foreground uppercase mb-1.5">
                    Aliases (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newAliases}
                    onChange={e => setNewAliases(e.target.value)}
                    placeholder="e.g. laboratory, room 3"
                    className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="border border-border/50 bg-muted/10 p-3">
                <p className="font-mono text-[10px] text-muted-foreground">
                  // API ID ranges: <span className="text-foreground">1301–1399</span> = individual map in map_sequence.yaml &nbsp;|&nbsp;
                  <span className="text-foreground">1401–1430</span> = batch group (1401 = group 1, maps 1-5)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddLocation}
                  disabled={addLoading || !newName.trim() || !newApiId.trim()}
                  className="px-5 py-2 border border-primary text-primary font-mono text-xs uppercase hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  {addLoading ? "SAVING..." : "[ SAVE LOCATION ]"}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewName(""); setNewApiId(""); setNewAliases(""); }}
                  className="px-5 py-2 border border-border text-muted-foreground font-mono text-xs uppercase hover:border-primary hover:text-primary transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* [03] Mapping Controls */}
      <section id="mapping" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[03]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">mapping</h2>
        </div>

        <div className="border border-border bg-card/50 p-6 space-y-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">// slam commands</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SLAM_COMMANDS.map(cmd => (
              <div key={cmd.key} className={`border p-4 transition-colors ${cmd.color.split(" ").filter(c => c.startsWith("border")).join(" ")}`}>
                <button
                  onClick={() => handleSlam(cmd.key)}
                  disabled={slamBusy === cmd.key || !status?.robot_agent_reachable}
                  className={`w-full font-mono text-sm font-bold uppercase mb-2 disabled:opacity-40 disabled:cursor-not-allowed ${cmd.color.split(" ").filter(c => c.startsWith("text")).join(" ")}`}
                >
                  {slamBusy === cmd.key ? "[ SENDING... ]" : `[ ${cmd.label} ]`}
                </button>
                <p className="font-mono text-[10px] text-muted-foreground">{cmd.desc}</p>
              </div>
            ))}
          </div>

          <div className="border border-yellow-400/20 bg-yellow-400/5 p-3 mt-2">
            <p className="font-mono text-[10px] text-yellow-400 uppercase">
              ⚠ Mapping order: Start Mapping → walk robot through area (15+ sec) → End Mapping → Relocation → Navigate
            </p>
          </div>
        </div>
      </section>

      {/* [04] Activity Log */}
      <section id="log" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <span className="text-primary font-mono text-sm">[04]</span>
            <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">activity log</h2>
          </div>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-red-400/40 hover:text-red-400 transition-colors"
          >
            CLEAR
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="border border-border bg-card/20 p-6 flex items-center justify-center">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">[ No activity yet ]</span>
          </div>
        ) : (
          <div className="bg-black/40 border border-border/50 p-4 h-64 overflow-y-auto font-mono text-[11px] space-y-1">
            {logs.map((log, i) => (
              <p key={i} className={
                log.type === "success" ? "text-green-400/80" :
                log.type === "error"   ? "text-red-400/80" :
                "text-muted-foreground"
              }>
                <span className="text-muted-foreground/40 mr-2">{log.ts}</span>
                {log.msg}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Quick reference */}
      <section className="border-t border-border pt-8">
        <p className="font-mono text-[10px] text-muted-foreground uppercase mb-4">// api id reference</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { range: "1301–1399", label: "Individual Maps", desc: "Run one map from map_sequence.yaml" },
            { range: "1401–1430", label: "Batch Groups",    desc: "Group 1=1401 (maps 1-5), Group 2=1402 (maps 6-10)…" },
            { range: "1201/1202", label: "Pause/Resume",    desc: "Control active navigation" },
            { range: "1205",      label: "Abort",           desc: "Stop entire map sequence immediately" },
          ].map(r => (
            <div key={r.range} className="border border-border/50 p-3">
              <p className="font-mono text-xs font-bold text-primary">{r.range}</p>
              <p className="font-mono text-[10px] text-foreground mt-1">{r.label}</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
