"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

type DocumentStatus = "uploaded" | "processing" | "indexed" | "error";

interface Document {
  id: string;
  name: string;
  size: string;
  type: string;
  status: DocumentStatus;
  uploadedAt: string;
  chunks?: number;
  error?: string;
}

const fileTypeIcons: Record<string, string> = {
  PDF: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  DOCX: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  TXT: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  MD: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
};

export default function Library() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDocuments();
      if (res.data) {
        const docs = (res.data as any[]).map((doc: any) => ({
          id: String(doc.id),
          name: doc.name || doc.filename || "Unknown",
          size: doc.size || formatFileSize(doc.file_size || 0),
          type: doc.file_type?.toUpperCase() || "UNKNOWN",
          status: doc.status as DocumentStatus,
          uploadedAt: doc.created_at || doc.uploadedAt || "-",
          chunks: doc.chunks_count || 0,
        }));
        setDocuments(docs);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || doc.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = async (files: File[]) => {
    setShowUploadModal(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(((i + 1) / files.length) * 100);
      
      try {
        const res = await api.uploadDocument(file);
        if (res.error) {
          console.error(`Failed to upload ${file.name}:`, res.error);
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }
    
    setShowUploadModal(false);
    setUploadProgress(0);
    
    // Refresh document list
    await fetchDocuments();
    
    // Poll for processing status
    const pollInterval = setInterval(async () => {
      await fetchDocuments();
    }, 3000);
    
    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const deleteDocument = async (id: string) => {
    try {
      const res = await api.deleteDocument(parseInt(id));
      if (!res.error) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        if (selectedDoc?.id === id) setSelectedDoc(null);
      } else {
        console.error("Failed to delete document:", res.error);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const reindexDocument = async (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, status: "processing" } : doc))
    );
    
    try {
      const res = await api.reindexDocument(parseInt(id));
      if (!res.error) {
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          const progressRes = await api.getDocumentProgress(parseInt(id));
          if (progressRes.data) {
            const data = progressRes.data as any;
            if (data.stage === "completed") {
              clearInterval(pollInterval);
              await fetchDocuments();
            } else if (data.stage === "failed") {
              clearInterval(pollInterval);
              setDocuments((prev) =>
                prev.map((doc) => (doc.id === id ? { ...doc, status: "error", error: data.error } : doc))
              );
            }
          }
        }, 3000);
        
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      } else {
        console.error("Failed to reindex document:", res.error);
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === id ? { ...doc, status: "error" } : doc))
        );
      }
    } catch (error) {
      console.error("Error reindexing document:", error);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, status: "error" } : doc))
      );
    }
  };

  const totalSize = documents.reduce((acc, doc) => {
    const size = parseFloat(doc.size.split(" ")[0]);
    const unit = doc.size.split(" ")[1];
    let bytes = size;
    if (unit === "KB") bytes *= 1024;
    if (unit === "MB") bytes *= 1024 * 1024;
    return acc + bytes;
  }, 0);

  return (
    <div className="flex-1 p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Library</h1>
            <p className="text-muted-foreground mt-1">Manage your documents and knowledge base</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm">Total Documents</p>
            <p className="text-3xl font-bold text-card-foreground mt-1">{documents.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm">Indexed</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{documents.filter(d => d.status === "indexed").length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm">Processing</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{documents.filter(d => d.status === "processing").length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm">Total Size</p>
            <p className="text-3xl font-bold text-card-foreground mt-1">{formatFileSize(totalSize)}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Status</option>
            <option value="indexed">Indexed</option>
            <option value="processing">Processing</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-all mb-6",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-foreground font-medium">Drop files here to upload</p>
          <p className="text-sm text-muted-foreground mt-1">or click the upload button above</p>
          <p className="text-xs text-muted-foreground mt-2">Supported: PDF, DOCX, TXT, MD (max 50MB)</p>
        </div>

        {/* Document List */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">No documents found</h3>
            <p className="text-muted-foreground">{documents.length === 0 ? "Upload your first document to get started" : "Try adjusting your search or filters"}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={cn(
                    "p-4 flex items-center gap-4 cursor-pointer transition-colors",
                    selectedDoc?.id === doc.id ? "bg-accent/50" : "hover:bg-accent/30"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fileTypeIcons[doc.type] || fileTypeIcons.PDF} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground truncate">{doc.name}</p>
                    <p className="text-sm text-muted-foreground">{doc.type} • {doc.size} • {doc.uploadedAt}</p>
                  </div>
                  {doc.chunks && (
                    <span className="hidden sm:block text-xs text-muted-foreground">{doc.chunks} chunks</span>
                  )}
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    doc.status === "indexed" && "bg-green-500/10 text-green-600",
                    doc.status === "processing" && "bg-yellow-500/10 text-yellow-600",
                    doc.status === "error" && "bg-red-500/10 text-red-600",
                    doc.status === "uploaded" && "bg-blue-500/10 text-blue-600"
                  )}>
                    {doc.status}
                  </span>
                  <div className="flex items-center gap-1">
                    {doc.status === "error" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); reindexDocument(doc.id); }}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                        title="Retry"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Uploading Documents...</h3>
              <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">{uploadProgress}%</p>
            </div>
          </div>
        )}

        {/* Document Details Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDoc(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fileTypeIcons[selectedDoc.type] || fileTypeIcons.PDF} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-card-foreground">{selectedDoc.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      selectedDoc.status === "indexed" && "bg-green-500/10 text-green-600",
                      selectedDoc.status === "processing" && "bg-yellow-500/10 text-yellow-600",
                      selectedDoc.status === "error" && "bg-red-500/10 text-red-600"
                    )}>
                      {selectedDoc.status}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-accent rounded-lg">
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">File Type</span>
                  <span className="font-medium text-card-foreground">{selectedDoc.type}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-medium text-card-foreground">{selectedDoc.size}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Uploaded</span>
                  <span className="font-medium text-card-foreground">{selectedDoc.uploadedAt}</span>
                </div>
                {selectedDoc.chunks && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Chunks</span>
                    <span className="font-medium text-card-foreground">{selectedDoc.chunks}</span>
                  </div>
                )}
                {selectedDoc.error && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Error</span>
                    <span className="font-medium text-red-500">{selectedDoc.error}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {selectedDoc.status === "error" && (
                  <button
                    onClick={() => { reindexDocument(selectedDoc.id); setSelectedDoc(null); }}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all"
                  >
                    Retry Indexing
                  </button>
                )}
                <button
                  onClick={() => { deleteDocument(selectedDoc.id); setSelectedDoc(null); }}
                  className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
