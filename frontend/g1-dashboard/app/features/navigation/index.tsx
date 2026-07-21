"use client";

import { useState, useEffect, useCallback } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { Play, Square, Map, Crosshair, Pause, Target, MapPin, Trash2, Plus, Navigation } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RobotMap {
  id: string;
  name: string;
  file_path: string;
  waypoints: any[];
  created_at: string;
}

export function NavigationModule() {
  const [logs, setLogs] = useState<{ts: string, msg: string, type: string}[]>([]);
  const [maps, setMaps] = useState<RobotMap[]>([]);
  const [activeMap, setActiveMap] = useState<RobotMap | null>(null);
  const [slamBusy, setSlamBusy] = useState<boolean>(false);
  
  // Mapping state
  const [isMapping, setIsMapping] = useState(false);
  const [newMapName, setNewMapName] = useState("");

  // Pose state
  const [currentPose, setCurrentPose] = useState<{x: number, y: number} | null>(null);

  // Tenant ID from local storage (simplified for this demo)
  const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") || "default" : "default";

  const addLog = useCallback((msg: string, type: "info" | "success" | "error" = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [{ ts, msg, type }, ...prev].slice(0, 50));
  }, []);

  const fetchMaps = useCallback(async () => {
    try {
      const r = await fetch(`${API}/navigation/maps`);
      if (r.ok) {
        const d = await r.json();
        setMaps(d.maps);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchPose = useCallback(async () => {
    try {
      const r = await fetch(`${API}/navigation/slam/pose/current`);
      if (r.ok) {
        const d = await r.json();
        if (d && d.x !== undefined) {
          setCurrentPose({x: d.x, y: d.y});
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMaps();
    const interval = setInterval(fetchPose, 2000);
    return () => clearInterval(interval);
  }, [fetchMaps, fetchPose]);

  // ── SLAM Actions ────────────────────────────────────────────────────────────

  async function handleStartMapping() {
    setSlamBusy(true);
    addLog("Starting mapping...", "info");
    try {
      const r = await fetch(`${API}/navigation/slam/map/start`, { method: "POST" });
      if (r.ok) {
        setIsMapping(true);
        addLog("✓ Mapping started. Please walk the robot around.", "success");
      } else {
        addLog("✗ Failed to start mapping", "error");
      }
    } catch {
      addLog("✗ Backend unreachable", "error");
    } finally {
      setSlamBusy(false);
    }
  }

  async function handleStopMapping() {
    if (!newMapName.trim()) {
      addLog("Please enter a name for the map.", "error");
      return;
    }
    setSlamBusy(true);
    addLog(`Stopping mapping & saving map as '${newMapName}'...`, "info");
    try {
      const r = await fetch(`${API}/navigation/slam/map/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMapName, tenant_id: tenantId })
      });
      if (r.ok) {
        setIsMapping(false);
        setNewMapName("");
        addLog("✓ Map saved successfully.", "success");
        fetchMaps();
      } else {
        addLog("✗ Failed to save map", "error");
      }
    } catch {
      addLog("✗ Backend unreachable", "error");
    } finally {
      setSlamBusy(false);
    }
  }

  async function handleDeleteMap(id: string) {
    if (!confirm("Are you sure you want to delete this map?")) return;
    try {
      const r = await fetch(`${API}/navigation/maps/${id}`, { method: "DELETE" });
      if (r.ok) {
        addLog("✓ Map deleted.", "success");
        fetchMaps();
      }
    } catch {
      addLog("✗ Backend unreachable", "error");
    }
  }

  // ── Navigation Actions ──────────────────────────────────────────────────────

  async function handleInitPose(map: RobotMap) {
    addLog(`Initializing pose on map '${map.name}'...`, "info");
    try {
      // We initialize at (0,0) by default for simplicity, assuming the robot starts where it started mapping.
      const r = await fetch(`${API}/navigation/slam/pose/init?address=${encodeURIComponent(map.file_path)}&x=0.0&y=0.0`, { method: "POST" });
      if (r.ok) {
        setActiveMap(map);
        addLog(`✓ Pose initialized. Ready to navigate on '${map.name}'.`, "success");
      }
    } catch {
      addLog("✗ Backend unreachable", "error");
    }
  }

  async function handleEmergencyStop() {
    addLog("EMERGENCY STOP Triggered!", "error");
    try {
      await fetch(`${API}/navigation/slam/navigate/pause`, { method: "POST" });
    } catch { /* ignore */ }
  }

  async function handleNavigateTo(x: number, y: number) {
    addLog(`Navigating to (${x.toFixed(2)}, ${y.toFixed(2)})...`, "info");
    try {
      const r = await fetch(`${API}/navigation/slam/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y })
      });
      if (r.ok) {
        addLog("✓ Navigation command sent.", "success");
      }
    } catch {
      addLog("✗ Backend unreachable", "error");
    }
  }

  // ── UI Render ───────────────────────────────────────────────────────────────

  return (
    <FeatureGate featureKey="navigation">
      <div className="max-w-6xl mx-auto space-y-12 pb-32 pt-8">
        
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
              Navigation
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-2 uppercase tracking-widest">
              Live SLAM Mapping & Waypoint Control
            </p>
          </div>
          
          <button 
            onClick={handleEmergencyStop}
            className="flex items-center gap-2 px-8 py-4 bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all rounded-lg font-bold uppercase tracking-widest"
          >
            <Square className="w-5 h-5 fill-current" />
            Emergency Stop
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Mapping Controls */}
          <div className="lg:col-span-1 space-y-8">
            <div className="border border-border p-6 rounded-xl bg-background/50 backdrop-blur">
              <h2 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                <Map className="w-5 h-5 text-primary" /> Map Generation
              </h2>
              
              {!isMapping ? (
                <button
                  disabled={slamBusy}
                  onClick={handleStartMapping}
                  className="w-full py-4 rounded bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20 font-bold tracking-widest transition-all flex justify-center items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Start New Map
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded text-sm font-mono text-blue-400 flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    Mapping in progress. Walk the robot around via remote.
                  </div>
                  <input 
                    type="text" 
                    placeholder="Enter Map Name (e.g. Office_F1)"
                    value={newMapName}
                    onChange={e => setNewMapName(e.target.value)}
                    className="w-full bg-background border border-border p-3 rounded font-mono text-sm"
                  />
                  <button
                    disabled={slamBusy || !newMapName.trim()}
                    onClick={handleStopMapping}
                    className="w-full py-4 rounded bg-blue-500/10 text-blue-500 border border-blue-500/30 hover:bg-blue-500/20 font-bold tracking-widest transition-all flex justify-center items-center gap-2"
                  >
                    <Square className="w-4 h-4" /> Stop & Save Map
                  </button>
                </div>
              )}
            </div>

            {/* Saved Maps List */}
            <div className="border border-border p-6 rounded-xl bg-background/50 backdrop-blur h-[400px] overflow-y-auto">
              <h2 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Saved Maps
              </h2>
              {maps.length === 0 ? (
                <p className="text-muted-foreground text-sm font-mono italic">No maps found in database.</p>
              ) : (
                <div className="space-y-3">
                  {maps.map(map => (
                    <div key={map.id} className={`p-4 rounded border ${activeMap?.id === map.id ? 'border-primary bg-primary/5' : 'border-border bg-background'} flex flex-col gap-3 transition-colors`}>
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold">{map.name}</span>
                        <button onClick={() => handleDeleteMap(map.id)} className="text-muted-foreground hover:text-red-400 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => handleInitPose(map)}
                        className="w-full py-2 bg-foreground/5 hover:bg-foreground/10 text-xs font-bold uppercase tracking-widest rounded border border-border flex justify-center items-center gap-2"
                      >
                        <Crosshair className="w-3 h-3" /> Initialize Pose Here
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Canvas / Log */}
          <div className="lg:col-span-2 space-y-8">
            <div className="border border-border p-6 rounded-xl bg-background/50 backdrop-blur min-h-[300px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold uppercase flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" /> Live Telemetry
                </h2>
                <div className="font-mono text-sm px-3 py-1 bg-background border border-border rounded">
                  Active Map: {activeMap ? <span className="text-primary font-bold">{activeMap.name}</span> : <span className="text-muted-foreground italic">None</span>}
                </div>
              </div>
              
              <div className="p-8 border border-border border-dashed rounded-lg bg-background flex flex-col items-center justify-center gap-4 text-center">
                {currentPose ? (
                  <>
                    <Target className="w-12 h-12 text-primary animate-pulse" />
                    <div>
                      <div className="text-3xl font-bold font-mono tracking-tighter">
                        X: {currentPose.x.toFixed(3)} <span className="text-muted-foreground">|</span> Y: {currentPose.y.toFixed(3)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 uppercase tracking-widest">Real-time coordinates</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Map className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-mono">Telemetry not available. Is SLAM running?</p>
                  </>
                )}
              </div>
              
              {activeMap && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Waypoint Navigation</h3>
                  <div className="flex gap-4">
                    <button onClick={() => handleNavigateTo(currentPose?.x ? currentPose.x + 0.2 : 0.2, currentPose?.y || 0)} className="flex-1 py-3 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 rounded font-bold text-xs uppercase tracking-widest">
                      Walk Forward (0.2m)
                    </button>
                    <button onClick={() => handleNavigateTo(0, 0)} className="flex-1 py-3 bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20 rounded font-bold text-xs uppercase tracking-widest">
                      Return to Origin (0,0)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal Logs */}
            <div className="border border-border rounded-xl bg-background/50 backdrop-blur overflow-hidden flex flex-col h-[300px]">
              <div className="px-4 py-2 border-b border-border bg-background flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-mono font-bold tracking-widest uppercase">System Logs</span>
              </div>
              <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground italic">Waiting for events...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-muted-foreground shrink-0">[{log.ts}]</span>
                      <span className={`
                        ${log.type === "error" ? "text-red-400" : ""}
                        ${log.type === "success" ? "text-green-400" : ""}
                        ${log.type === "info" ? "text-foreground" : ""}
                      `}>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
