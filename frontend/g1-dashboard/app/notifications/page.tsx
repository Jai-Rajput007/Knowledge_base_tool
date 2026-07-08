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

  useEffect(() => {
    console.log("[NotificationsPage] Component mounted. Fetching notifications...");
    // Placeholder notifications
    const mockData = [
      { id: 1, type: "info", message: "System update v2.4.0 is now available.", date: "2 mins ago" },
      { id: 2, type: "success", message: "Vector DB indexing completed successfully.", date: "1 hour ago" },
      { id: 3, type: "warning", message: "API rate limit approaching for current billing cycle.", date: "2 hours ago" },
    ];
    setNotifications(mockData);
    console.log("[NotificationsPage] Successfully loaded mock notifications:", mockData);
  }, []);

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
        {notifications.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No new notifications.</div>
        ) : (
          notifications.map((notif, index) => (
            <div
              key={notif.id}
              className="p-4 rounded-xl bg-card border border-border flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-background rounded-lg shadow-sm border border-border">
                {notif.type === "info" && <FiInfo className="text-blue-500" />}
                {notif.type === "success" && <FiCheckCircle className="text-green-500" />}
                {notif.type === "warning" && <FiAlertCircle className="text-amber-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{notif.date}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
