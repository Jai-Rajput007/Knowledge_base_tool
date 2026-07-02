import React from "react";

interface AdvancedSearchOptionsProps {
  showAdvancedOptions: boolean;
  sectionPath: string;
  setSectionPath: (val: string) => void;
  parentSection: string;
  setParentSection: (val: string) => void;
  contentTypes: string[];
  setContentTypes: React.Dispatch<React.SetStateAction<string[]>>;
  includeParentContext: boolean;
  setIncludeParentContext: (val: boolean) => void;
  contextStrategy: string;
  setContextStrategy: (val: "hierarchy" | "relevance" | "chronological" | "compress" | "standard") => void;
  enableQueryProcessing: boolean;
  setEnableQueryProcessing: (val: boolean) => void;
  useExtractedFilters: boolean;
  setUseExtractedFilters: (val: boolean) => void;
}

export function AdvancedSearchOptions({
  showAdvancedOptions, sectionPath, setSectionPath, parentSection, setParentSection,
  contentTypes, setContentTypes, includeParentContext, setIncludeParentContext,
  contextStrategy, setContextStrategy, enableQueryProcessing, setEnableQueryProcessing,
  useExtractedFilters, setUseExtractedFilters
}: AdvancedSearchOptionsProps) {
  if (!showAdvancedOptions) return null;

  return (
    <div className="mx-4 mt-3 p-3 bg-accent/50 rounded-lg border border-border space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Section Path</label>
          <input
            type="text"
            value={sectionPath}
            onChange={(e) => setSectionPath(e.target.value)}
            placeholder="e.g., Chapter 1 > Introduction"
            className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Parent Section</label>
          <input
            type="text"
            value={parentSection}
            onChange={(e) => setParentSection(e.target.value)}
            placeholder="e.g., Chapter 1"
            className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Content Types</label>
        <div className="flex flex-wrap gap-2">
          {["table", "list", "code", "heading"].map((type) => (
            <button
              key={type}
              onClick={() => {
                setContentTypes(prev => 
                  prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                )
              }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                contentTypes.includes(type) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:border-primary/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeParentContext} onChange={(e) => setIncludeParentContext(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
          <span className="text-xs text-muted-foreground">Include parent context</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enableQueryProcessing} onChange={(e) => setEnableQueryProcessing(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
          <span className="text-xs text-muted-foreground">Query processing</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useExtractedFilters} onChange={(e) => setUseExtractedFilters(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
          <span className="text-xs text-muted-foreground">Auto-extract filters</span>
        </label>
      </div>

      <div className="pt-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Context Strategy</label>
        <select value={contextStrategy} onChange={(e) => setContextStrategy(e.target.value as any)} className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="hierarchy">Hierarchy (Maintains document structure)</option>
          <option value="relevance">Relevance (Highest semantic match first)</option>
          <option value="chronological">Chronological (Document order)</option>
          <option value="compress">Compress (LLM summary of context)</option>
          <option value="standard">Standard (Raw chunks)</option>
        </select>
      </div>
    </div>
  );
}
