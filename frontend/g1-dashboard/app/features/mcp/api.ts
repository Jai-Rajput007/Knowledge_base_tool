import { Integration, ConfigFormValues } from "./types";

import { api as coreApi } from "@/lib/api";

export const api = {
  getMcpIntegrations: async (): Promise<{ data: { integrations: Integration[] } }> => {
    const res = await coreApi.getMcpIntegrations();
    if (res.error) throw new Error(res.error);
    const data = res.data;
    
    // Map the backend data format to the frontend expected format (is_active)
    const integrations: Integration[] = ((data as any[]) || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      is_active: item.isEnabled,
      provider: item.provider,
      config_schema: item.providerConfig ? JSON.parse(item.providerConfig) : undefined,
      config_values: item.credentials ? JSON.parse(item.credentials) : undefined
    }));
    
    return { data: { integrations } };
  },
  toggleMcpIntegration: async (id: string, is_active: boolean): Promise<void> => {
    const res = await coreApi.configureMcpIntegration({ mcpId: id, isEnabled: is_active });
    if (res.error) throw new Error(res.error);
  },
  updateMcpIntegrationConfig: async (id: string, config_values: ConfigFormValues): Promise<void> => {
    const res = await coreApi.configureMcpIntegration({ mcpId: id, isEnabled: true, credentials: config_values });
    if (res.error) throw new Error(res.error);
  },
  generateComposioLink: async (mcpId: string): Promise<string> => {
    const res = await coreApi.generateComposioLink(mcpId);
    if (res.error) throw new Error(res.error);
    return (res.data as any).redirectUrl;
  }
};
