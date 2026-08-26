import { useState, useCallback, useEffect } from "react";
import { api } from "../api";
import { Integration, ConfigFormValues } from "../types";

export function useMcpState() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ConfigFormValues>({});
  const [saving, setSaving] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMcpIntegrations();
      if ((res.data as any)?.integrations) {
        setIntegrations((res.data as any).integrations);
      }
    } catch (error) {
      console.error("Failed to load integrations", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'google_auth_success') {
        fetchIntegrations();
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchIntegrations]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const original = [...integrations];
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_active: !currentStatus } : i));
    try {
      await api.toggleMcpIntegration(id, !currentStatus);
    } catch (error) {
      setIntegrations(original);
      console.error("Failed to toggle integration", error);
    }
  };

  const handleConfigureClick = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    // Composio apps: always trigger OAuth flow directly.
    // config_schema for composio apps only contains { app: "slack" } (our providerConfig),
    // not real form fields — so we never show the manual fields modal for composio.
    if (integration.provider === "composio") {
      try {
        setLoading(true);
        const url = await api.generateComposioLink(id);
        // Open in new tab so user can complete OAuth without losing the dashboard
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.error("[MCP] Failed to generate composio connect link:", e);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Non-composio apps (public tools, taylorwilsdon legacy): show config modal
    setConfiguringId(id);
    if (integration.config_schema) {
      const initialValues: ConfigFormValues = {};
      Object.keys(integration.config_schema).forEach(key => {
        initialValues[key] = integration.config_values?.[key] || "";
      });
      setFormValues(initialValues);
    }
  };

  const handleSaveConfig = async () => {
    if (!configuringId) return;
    setSaving(true);
    try {
      await api.updateMcpIntegrationConfig(configuringId, formValues);
      setConfiguringId(null);
      await fetchIntegrations();
    } catch (error) {
      console.error("Failed to save config", error);
    } finally {
      setSaving(false);
    }
  };

  return {
    integrations, loading, configuringId, setConfiguringId,
    formValues, setFormValues, saving,
    handleToggle, handleConfigureClick, handleSaveConfig
  };
}
