import { Integration, ConfigFormValues } from "./types";

export const api = {
  getMcpIntegrations: async (): Promise<{ data: { integrations: Integration[] } }> => {
    const res = await fetch("/api/mcp");
    if (!res.ok) throw new Error("Failed to fetch integrations");
    const data = await res.json();
    
    // Map the backend data format (isEnabled) to the frontend expected format (is_active)
    const integrations: Integration[] = data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      is_active: item.isEnabled,
      config_schema: item.configSchema ? JSON.parse(item.configSchema) : undefined,
      config_values: item.credentials ? JSON.parse(item.credentials) : undefined
    }));
    
    return { data: { integrations } };
  },
  toggleMcpIntegration: async (id: string, is_active: boolean): Promise<void> => {
    const res = await fetch(`/api/mcp/configure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcpId: id, isEnabled: is_active })
    });
    if (!res.ok) throw new Error("Failed to toggle integration");
  },
  updateMcpIntegrationConfig: async (id: string, config_values: ConfigFormValues): Promise<void> => {
    // Note: We need to provide isEnabled to avoid breaking the create block if it's the first time
    const res = await fetch(`/api/mcp/configure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcpId: id, isEnabled: true, credentials: config_values })
    });
    if (!res.ok) throw new Error("Failed to update config");
  }
};
