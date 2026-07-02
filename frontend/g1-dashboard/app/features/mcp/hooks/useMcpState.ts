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
      if (res.data?.integrations) {
        setIntegrations(res.data.integrations);
      }
    } catch (error) {
      console.error("Failed to load integrations", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
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

  const handleConfigureClick = (id: string) => {
    setConfiguringId(id);
    const integration = integrations.find(i => i.id === id);
    if (integration?.config_schema) {
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
