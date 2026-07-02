import React from "react";
import { ConfigFormValues, Integration } from "../types";

interface ConfigModalProps {
  configuringId: string | null;
  integrations: Integration[];
  formValues: ConfigFormValues;
  saving: boolean;
  onClose: () => void;
  onFormChange: (key: string, value: string) => void;
  onSave: () => void;
}

export function ConfigModal({ 
  configuringId, integrations, formValues, saving, onClose, onFormChange, onSave 
}: ConfigModalProps) {
  if (!configuringId) return null;
  
  const integration = integrations.find(i => i.id === configuringId);
  if (!integration) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg uppercase tracking-wide">Configuration</h3>
            <p className="text-xs font-mono text-muted-foreground mt-1">{integration.name} Settings</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {integration.config_schema && Object.entries(integration.config_schema).map(([key, schema]) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-bold text-foreground">
                {schema.title || key}
                {schema.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={schema.type === 'password' ? 'password' : 'text'}
                value={formValues[key] || ''}
                onChange={(e) => onFormChange(key, e.target.value)}
                placeholder={schema.description}
                className="w-full px-4 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ))}
        </div>
        
        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm font-mono uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Saving...</>
            ) : (
              'Save Config'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
