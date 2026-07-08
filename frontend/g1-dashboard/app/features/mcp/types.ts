export interface Integration {
  id: string;
  name: string;
  description?: string;
  category: string;
  is_active: boolean;
  provider?: string;
  config_schema?: Record<string, any>;
  config_values?: Record<string, string>;
  isConfigured?: boolean;
}

export type ConfigFormValues = Record<string, string>;
