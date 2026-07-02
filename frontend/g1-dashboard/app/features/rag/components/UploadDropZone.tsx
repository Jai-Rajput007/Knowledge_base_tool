import React from "react";

interface UploadDropZoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function UploadDropZone({
  isDragging, onDragOver, onDragLeave, onDrop, onFileSelect, fileInputRef
}: UploadDropZoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border-2 border-dashed p-12 text-center transition-all ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50 hover:bg-card/50"
      }`}
    >
      <div className="w-16 h-16 mx-auto mb-6 bg-secondary/50 flex items-center justify-center text-muted-foreground">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <h3 className="text-xl font-bold uppercase tracking-wide mb-2">Initialize Data Transfer</h3>
      <p className="text-sm text-muted-foreground mb-6 font-mono">
        // Supported formats: PDF, DOCX, TXT, MD, CSV, JSON
      </p>
      
      <div className="flex items-center justify-center gap-4">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-primary text-primary-foreground text-sm uppercase font-mono tracking-wider hover:opacity-90 transition-opacity"
        >
          Select Files
        </button>
        <span className="text-xs font-mono text-muted-foreground uppercase">or drag and drop</span>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv,.json,.html"
        className="hidden"
        onChange={onFileSelect}
      />
    </div>
  );
}
