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

    if (integration.provider === "composio" && (!integration.config_schema || Object.keys(integration.config_schema).length === 0 || integration.config_schema.auth_config_id)) {
      // It's an OAuth integration (like GitHub) that doesn't require manual fields
      try {
        setLoading(true);
        const url = await api.generateComposioLink(id);
        window.location.href = url;
      } catch (e) {
        console.error("Failed to generate connect link", e);
      } finally {
        setLoading(false);
      }
      return;
    }

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
