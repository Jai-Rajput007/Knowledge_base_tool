"use client";

import React, { useEffect, useState } from "react";
import { FiBell, FiCheckCircle, FiInfo, FiAlertCircle } from "react-icons/fi";

/**
 * Notifications Page
 * 
 * This page displays system notifications, alerts, and updates to the user.
 * It is accessed via the notification bell in the top-right HeaderActions.
 * 
 * Future updates: Integrate with backend notification service to fetch real-time
 * alerts and notifications instead of placeholder data.
 */

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { api } = await import("@/lib/api");
      const response = await (api as any).request("/notifications");
      setNotifications(response.data || []);
    } catch (err) {
      console.error("[NotificationsPage] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { api } = await import("@/lib/api");
      await (api as any).request(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter text-foreground flex items-center gap-3">
          <FiBell className="text-primary" /> Notifications
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.NOTIFICATIONS // View recent system alerts and updates
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-12 animate-pulse">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No new notifications.</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`p-4 rounded-xl border flex items-start gap-4 transition-shadow cursor-pointer ${
                notif.is_read ? "bg-card/50 border-border opacity-70" : "bg-card border-primary/50 shadow-md shadow-primary/5"
              }`}
            >
              <div className="p-2 bg-background rounded-lg shadow-sm border border-border">
                {notif.type === "info" && <FiInfo className="text-blue-500" />}
                {notif.type === "success" && <FiCheckCircle className="text-green-500" />}
                {(notif.type === "warning" || notif.type === "error") && <FiAlertCircle className="text-amber-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${notif.is_read ? "text-foreground/80" : "font-bold text-foreground"}`}>
                    {notif.message}
                  </p>
                  {!notif.is_read && <span className="w-2 h-2 bg-primary rounded-full"></span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(notif.date)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
