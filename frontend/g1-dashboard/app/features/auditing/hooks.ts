import { useState, useEffect } from "react";
import { getAuditLogs } from "./api";
import { AuditLogsResponse } from "./types";

export const useAuditLogs = (limit = 50, offset = 0) => {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchLogs = async () => {
      try {
        const result = await getAuditLogs(limit, offset);
        if (isMounted) {
          setData(result);
          setIsError(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchLogs();

    // Poll every 10 seconds
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [limit, offset]);

  return {
    data,
    isLoading,
    isError
  };
};
