"use client";

import React, { useEffect, useState, useRef } from "react";
import { FiLifeBuoy, FiPlus, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "motion/react";
import { FeatureGate } from "@/app/components/feature-gate";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
};

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export function SupportTicketsModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<any>(null);

  // Form State
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string; visible: boolean}>({ message: "", visible: false });

  // Store ref to previous tickets to detect status changes
  const prevTicketsRef = React.useRef<Ticket[]>([]);
  const lastSeqRef = useRef<number>(-1);

  useEffect(() => {
    fetchProfileAndTickets();
    
    // Simple interval-based polling using the monotonic counter from /api/events.
    // Each GET returns immediately — no hanging Promises to leak in Turbopack.
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch("/api/events", { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const newSeq = data.seq as number;

        if (lastSeqRef.current === -1) {
          lastSeqRef.current = newSeq;
          return;
        }

        if (newSeq !== lastSeqRef.current) {
          lastSeqRef.current = newSeq;
          fetchTicketsOnly();
        }
      } catch {
        // network blip — will retry on next interval
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  const fetchProfileAndTickets = async () => {
    try {
      // Fetch profile directly via proxy if available or backend
      const profileRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/tenant/profile", {
        headers: getAuthHeaders()
      });
      if (profileRes.ok) {
        setTenantProfile(await profileRes.json());
      }
      await fetchTicketsOnly();
    } catch (error) {
      console.error("Failed to load initial data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketsOnly = async () => {
    try {
      const res = await fetch("/api/tickets", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.tickets && Array.isArray(data.tickets)) {
        // Check if any status changed
        if (prevTicketsRef.current.length > 0) {
          const oldStatusMap = new Map(prevTicketsRef.current.map(t => [t.id, t.status]));
          
          for (const newTicket of data.tickets) {
            const oldStatus = oldStatusMap.get(newTicket.id);
            if (oldStatus && oldStatus !== newTicket.status) {
              showToast(`Ticket "${newTicket.subject}" status changed to ${newTicket.status}`);
            }
          }
        }
        
        prevTicketsRef.current = data.tickets;
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error("Failed to fetch tickets", error);
    }
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantProfile) return alert("Tenant profile not loaded");
    
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          tenantId: tenantProfile.id,
          name: tenantProfile.name || "Tenant Admin",
          email: tenantProfile.hostEmail || "admin@tenant.com",
          subject,
          description
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setTickets([data.ticket, ...tickets]);
        setIsModalOpen(false);
        setSubject("");
        setDescription("");
      } else {
        alert("Failed to submit ticket");
      }
    } catch (error) {
      console.error("Submit error", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "UNDER REVIEW": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <FeatureGate featureKey="tickets">
      <div className="h-full p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto pb-32">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast.visible && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-3"
            >
              <FiLifeBuoy className="text-xl" />
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FiLifeBuoy className="text-primary" />
              Support Tickets
            </h1>
            <p className="text-muted-foreground mt-2">
              Need help? Report bugs or request assistance from the platform admin.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium shadow hover:bg-primary/90 transition-colors"
          >
            <FiPlus /> Raise a ticket
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <FiLifeBuoy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium">No Tickets Yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              You haven't submitted any support requests. If you encounter an issue, feel free to open a new ticket.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                      <span>ID: {ticket.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm whitespace-pre-wrap opacity-80">{ticket.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Ticket Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                  <h2 className="text-xl font-semibold">Create Support Ticket</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                    <FiX />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Brief description of the issue"
                      className="w-full bg-background border border-input rounded-lg px-4 py-2.5 outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      required
                      rows={5}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Provide details about the bug or your request..."
                      className="w-full bg-background border border-input rounded-lg px-4 py-2.5 outline-none focus:border-primary transition-colors resize-none"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium shadow hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : null}
                      Submit Ticket
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </FeatureGate>
  );
}
