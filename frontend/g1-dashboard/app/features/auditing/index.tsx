"use client";

import React, { useRef, useState, useMemo } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiDownload, FiSearch } from "react-icons/fi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuditLogs } from "./hooks";

function formatTimeAgo(dateString: string) {
  // Ensure the date is treated as UTC by appending 'Z' if not present
  const normalizedDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const date = new Date(normalizedDateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) return "Just now"; // Handle slight clock skew
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} days ago`;
}

function getActionName(method: string, endpoint: string): string {
  const path = endpoint.toLowerCase();
  
  // -- Auth --
  if (path.includes("/auth/login")) return "User Login";
  if (path.includes("/auth/change-password")) return "Change Password";
  if (path.includes("/auth/reset-password")) return "Reset Password";
  if (path.includes("/auth/users") && method === "POST") return "Create User";
  if (path.includes("/auth/users") && method === "PUT") return "Update User";
  if (path.includes("/auth/users") && method === "DELETE") return "Delete User";
  
  // -- Personas --
  if (path.includes("/personas/generate")) return "Generate Persona";
  if (path.includes("/personas/persona") && method === "POST") return "Update Active Persona";
  if (path.match(/\/personas\/.*?\/deploy/)) return "Deploy Persona";
  if (path.match(/\/personas$/) && method === "POST") return "Create Persona";
  if (path.match(/\/personas\/.+/) && method === "PUT") return "Update Persona";
  if (path.match(/\/personas\/.+/) && method === "DELETE") return "Delete Persona";
  
  // -- Chat --
  if (path.includes("/chat/stream")) return "Stream Chat";
  if (path.includes("/chat") && method === "POST") return "Send Chat Message";
  
  // -- Documents --
  if (path.includes("/documents/upload")) return "Upload Document";
  if (path.includes("/documents/") && method === "POST" && path.includes("reindex")) return "Reindex Document";
  if (path.includes("/documents/") && method === "DELETE") return "Delete Document";
  
  // -- Employees (FRS) --
  if (path.includes("/employees/bulk")) return "Bulk Import Employees";
  if (path.includes("/employees/") && method === "POST" && path.includes("photos")) return "Add Employee Photos";
  if (path.includes("/employees/context/") && path.includes("summary")) return "Generate Employee Summary";
  if (path.match(/\/employees$/) && method === "POST") return "Create Employee";
  if (path.match(/\/employees\/.+/) && method === "DELETE") return "Delete Employee";
  
  // -- Gestures --
  if (path.includes("/gestures/custom/record/start")) return "Start Gesture Record";
  if (path.includes("/gestures/custom/record/stop")) return "Stop Gesture Record";
  if (path.includes("/gestures/custom/") && method === "POST" && path.includes("play")) return "Play Custom Gesture";
  if (path.includes("/gestures/custom/") && method === "DELETE") return "Delete Custom Gesture";
  
  // -- Wakewords --
  if (path.includes("/wakeword/train")) return "Start Wakeword Training";
  if (path.includes("/wakeword/jobs/") && path.includes("deploy")) return "Deploy Wakeword";
  if (path.includes("/wakeword/jobs/") && path.includes("sync")) return "Sync Wakeword Job";
  if (path.includes("/wakeword/robot/") && path.includes("maintenance/start")) return "Start Robot Maintenance";
  if (path.includes("/wakeword/robot/") && path.includes("maintenance/stop")) return "Stop Robot Maintenance";
  if (path.includes("/wakeword/jobs/") && method === "DELETE" && path.includes("local-cancel")) return "Cancel Wakeword Job";
  if (path.includes("/wakeword/jobs/") && method === "DELETE") return "Delete Wakeword Job";
  
  // -- Navigation --
  if (path.includes("/navigation/go")) return "Navigate to Waypoint";
  if (path.includes("/navigation/locations") && method === "POST") return "Add Waypoint";
  if (path.includes("/navigation/locations") && method === "PUT") return "Update Waypoint";
  if (path.includes("/navigation/locations") && method === "DELETE") return "Delete Waypoint";
  if (path.includes("/navigation/slam/")) return "Send SLAM Command";
  
  // -- Memory --
  if (path.includes("/memory/wipe")) return "Wipe Memory";
  if (path.includes("/memory/") && method === "DELETE") return "Delete Memory Fact";
  
  // -- Retrieve --
  if (path.includes("/retrieve") && method === "POST") return "Retrieve Context";
  
  // -- Sessions --
  if (path.includes("/sessions/cleanup/old")) return "Cleanup Old Sessions";
  if (path.includes("/sessions/") && method === "POST") return "Create Session";
  if (path.includes("/sessions/") && path.includes("pin")) return "Toggle Session Pin";
  if (path.match(/\/sessions\/.+/) && method === "PUT") return "Update Session";
  if (path.match(/\/sessions\/.+/) && method === "DELETE") return "Delete Session";
  
  // -- Settings / Tenant --
  if (path.includes("/settings") && method === "PUT") return "Update Settings";
  if (path.includes("/tenant/profile") && method === "PUT") return "Update Tenant Profile";
  if (path.includes("/tenant/features/sync")) return "Sync Tenant Features";
  if (path.includes("/tenant/mcp/sync")) return "Sync Tenant MCPs";
  if (path.includes("/tenant/tickets/sync")) return "Sync Tickets";
  if (path.includes("/tenant/users/sync")) return "Sync Users";
  if (path.includes("/tenant/tickets") && method === "POST") return "Create Ticket";
  
  // -- MCP --
  if (path.includes("/mcp/configure")) return "Configure MCP Integration";
  if (path.includes("/mcp/composio-link")) return "Generate Composio Link";

  // Fallback for unmapped endpoints
  return `${method} ${endpoint}`;
}

function getStatusName(statusCode: string): string {
  if (statusCode.startsWith("2")) return "Success";
  if (statusCode.startsWith("4")) return "Failed (Client Error)";
  if (statusCode.startsWith("5")) return "Failed (Server Error)";
  return `Code ${statusCode}`;
}

gsap.registerPlugin(useGSAP);

export function AuditingModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useAuditLogs();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];
    if (!searchQuery.trim()) return data.logs;
    
    const query = searchQuery.toLowerCase();
    return data.logs.filter((log) => {
      const actionName = getActionName(log.method, log.endpoint).toLowerCase();
      return (
        actionName.includes(query) ||
        getStatusName(log.status).toLowerCase().includes(query) ||
        log.name.toLowerCase().includes(query) ||
        log.email.toLowerCase().includes(query)
      );
    });
  }, [data?.logs, searchQuery]);

  useGSAP(() => {
    if (filteredLogs.length > 0) {
      gsap.fromTo(
        ".audit-row",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
      );
    }
  }, { dependencies: [filteredLogs], scope: containerRef });

  const handleExportCSV = () => {
    if (!data?.logs) return;
    
    // Create CSV content
    const headers = ["User Name", "User Email", "Action", "Status", "Timestamp"];
    const rows = filteredLogs.map(log => [
      log.name,
      log.email,
      getActionName(log.method, log.endpoint),
      getStatusName(log.status),
      log.timestamp
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(item => `"${item}"`).join(","))
    ].join("\n");
    
    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <FeatureGate featureKey="auditing">
      <div ref={containerRef} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative w-full sm:w-96">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search audit logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border pl-12 pr-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors rounded-lg shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={handleExportCSV}
              disabled={!data?.logs || data.logs.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity rounded-lg shadow-sm disabled:opacity-50"
            >
              <FiDownload /> Export CSV
            </button>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card/30">
          <div className="grid grid-cols-7 gap-4 p-4 border-b border-border bg-muted/50 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2">User</div>
            <div className="col-span-2">Action</div>
            <div>Status</div>
            <div className="col-span-2 text-right">Timestamp</div>
          </div>

          <div className="flex flex-col max-h-[600px] overflow-y-auto">
            {isLoading && <div className="p-8 text-center text-muted-foreground font-mono">Loading audit logs...</div>}
            {isError && <div className="p-8 text-center text-red-500 font-mono">Error loading audit logs</div>}
            
            {!isLoading && !isError && filteredLogs.length === 0 && (
              <div className="p-8 text-center text-muted-foreground font-mono">
                {searchQuery ? "No logs match your search." : "No audit logs found."}
              </div>
            )}

            {!isLoading && !isError && filteredLogs.map((log) => {
              const isSuccess = log.status && log.status.startsWith("2");
              const timeAgo = formatTimeAgo(log.timestamp);
              const actionName = getActionName(log.method, log.endpoint);
              const statusName = getStatusName(log.status);
              
              return (
                <div 
                  key={log.id}
                  className="audit-row grid grid-cols-7 gap-4 p-4 items-center border-b border-border/50 hover:bg-card/50 transition-colors last:border-0"
                >
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="font-bold text-sm text-foreground truncate">{log.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">{log.email}</span>
                  </div>

                  <div className="col-span-2 flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-bold text-sm text-foreground truncate">{actionName}</span>
                    </div>
                  </div>
                  
                  <div className="font-mono text-xs">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${isSuccess ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {statusName}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-right font-mono text-xs text-muted-foreground">{timeAgo} <br/><span className="text-[9px] opacity-50">{new Date(log.timestamp).toLocaleString()}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
