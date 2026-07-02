export interface Integration {
  id: string;
  name: string;
  description?: string;
  category: string;
  is_active: boolean;
  config_schema?: Record<string, any>;
  config_values?: Record<string, string>;
}

export type ConfigFormValues = Record<string, string>;
