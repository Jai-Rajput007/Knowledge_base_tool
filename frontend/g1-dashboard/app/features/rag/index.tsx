"use client";

import React, { useRef, useCallback } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useRagState } from "./hooks/useRagState";
import { RagStats } from "./components/RagStats";
import { UploadDropZone } from "./components/UploadDropZone";
import { DocumentList } from "./components/DocumentList";
import { UploadModal } from "./components/UploadModal";

export function RagModule() {
  const {
    documents,
    searchQuery,
    setSearchQuery,
    selectedStatus,
    setSelectedStatus,
    isDragging,
    setIsDragging,
    showUploadModal,
    uploadProgress,
    handleFiles,
    deleteDocument,
    reindexDocument,
    formatFileSize,
  } = useRagState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles, setIsDragging]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || doc.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <FeatureGate featureKey="rag">
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <div className="border-b border-border pb-6">
          <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
            Knowledge Hub
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            SYS.CONFIG // Configure system parameters and operational protocols
          </p>
        </div>

        <section id="document" className="min-h-[50vh] border-t border-border pt-8 scroll-mt-28">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <span className="text-primary font-mono text-sm">[01]</span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Document Library</h2>
            </div>
          </div>
          
          <div className="border border-border bg-card/50 p-6">
            <p className="text-xs font-mono text-muted-foreground uppercase mb-6">
              // Manage your documents and knowledge base
            </p>

            <RagStats documents={documents} formatFileSize={formatFileSize} />

            <div className="mb-8">
              <UploadDropZone 
                isDragging={isDragging}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFileSelect={onFileSelect}
                fileInputRef={fileInputRef}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-background border border-border px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-background border border-border px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">All Status</option>
                <option value="indexed">Indexed</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>
            </div>

            <DocumentList 
              documents={filteredDocs} 
              onDelete={deleteDocument} 
              onReindex={reindexDocument} 
            />
          </div>
        </section>
      </div>

      <UploadModal show={showUploadModal} progress={uploadProgress} />
    </FeatureGate>
  );
}