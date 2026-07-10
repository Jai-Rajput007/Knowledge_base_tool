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
          {integration.provider === "taylorwilsdon/google_workspace_mcp" ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="w-16 h-16 bg-white rounded-full p-3 shadow flex items-center justify-center relative">
                <svg viewBox="0 0 48 48" className="w-full h-full">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                {integration.isConfigured && (
                  <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1 border-2 border-card">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <h4 className="text-xl font-bold text-foreground">
                {integration.isConfigured ? 'Google Workspace Connected' : 'Connect Google Workspace'}
              </h4>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {integration.isConfigured 
                  ? 'Your AGX Assistant is securely connected to your Google Workspace.'
                  : 'Authorize AGX Assistant to access your Gmail, Calendar, and Drive securely.'}
              </p>
              <button 
                onClick={() => window.open((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + '/mcp/google/login', '_blank')}
                className={`mt-4 px-6 py-3 font-semibold rounded-md shadow flex items-center gap-3 transition-colors ${
                  integration.isConfigured 
                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
              >
                {!integration.isConfigured && (
                  <svg viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                )}
                {integration.isConfigured ? 'Re-Authenticate' : 'Sign in with Google'}
              </button>
            </div>
          ) : (
            <>
              {integration.provider === 'composio' && (
                <div className="bg-primary/10 border border-primary/20 rounded p-4 mb-4">
                  <h5 className="font-bold text-sm mb-1">Composio OAuth Verification</h5>
                  <p className="text-xs text-muted-foreground mb-3">
                    To connect your accounts (like GitHub), you must verify them on the Composio Dashboard first, then enter your API key below.
                  </p>
                  <a href="https://dashboard.composio.dev/" target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                    &rarr; Open Composio Dashboard
                  </a>
                </div>
              )}
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
            </>
          )}
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
