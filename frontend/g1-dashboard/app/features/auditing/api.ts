import { api } from "@/lib/api";
import { AuditLogsResponse } from "./types";

export const getAuditLogs = async (limit = 50, offset = 0): Promise<AuditLogsResponse> => {
  const { data } = await api.getAuditLogs(limit, offset);
  return data as AuditLogsResponse;
};
