"use client";

import { useEffect, useState } from "react";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle,
  MessageSquare
} from "lucide-react";

type Ticket = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  tenant: {
    name: string;
  };
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "RESOLVED": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "UNDER REVIEW": return <Clock className="w-4 h-4 text-amber-400" />;
      default: return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">
            Manage and respond to tenant support requests across the platform.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/50"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-foreground/5 rounded-xl border border-foreground/10">
          <MessageSquare className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground">No Tickets Found</h3>
          <p className="text-muted-foreground">There are currently no support tickets.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className="bg-foreground/5 rounded-xl border border-foreground/10 p-6 hover:border-foreground/20 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">{ticket.subject}</h3>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-foreground/5 border border-foreground/10 text-foreground">
                      <StatusIcon status={ticket.status} />
                      {ticket.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>From: {ticket.name} ({ticket.email})</span>
                    <span>•</span>
                    <span>Tenant: {ticket.tenant?.name || ticket.tenantId}</span>
                    <span>•</span>
                    <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {ticket.status !== "UNDER REVIEW" && (
                    <button
                      onClick={() => updateStatus(ticket.id, "UNDER REVIEW")}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20 shadow-sm"
                    >
                      Mark Under Review
                    </button>
                  )}
                  {ticket.status !== "RESOLVED" && (
                    <button
                      onClick={() => updateStatus(ticket.id, "RESOLVED")}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 shadow-sm"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-foreground/10">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
