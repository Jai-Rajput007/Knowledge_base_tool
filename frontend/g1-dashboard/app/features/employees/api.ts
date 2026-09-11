import { api } from "@/lib/api";

/** FRS live feed: exchange the admin session for a 60 s ticket, then build the <img> stream URL. */
export const liveFeedApi = {
  open: async (): Promise<{ url: string; maxSeconds: number }> => {
    const res = await api.frsLiveFeedTicket();
    if (res.error || !res.data) {
      let message = res.error ?? "Could not open the live feed";
      try {
        const parsed = JSON.parse(message);
        if (typeof parsed?.detail === "string") message = parsed.detail;
      } catch {
        /* plain text */
      }
      throw new Error(message);
    }
    return { url: api.frsLiveFeedStreamUrl(res.data.ticket), maxSeconds: res.data.max_seconds };
  },

  isAdmin: async (): Promise<boolean> => {
    const res = await api.getCurrentUser();
    return (res.data as { role?: string } | undefined)?.role === "admin";
  },
};
