import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { Document, DocumentStatus } from "../types";

export function useRagState() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFiles = async (files: File[]) => {
    setShowUploadModal(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(((i + 1) / files.length) * 100);
      try {
        await api.uploadDocument(file);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }
    setShowUploadModal(false);
    setUploadProgress(0);
    await fetchDocuments();
    
    // Poll for status updates for 2 mins
    let polls = 0;
    const pollInterval = setInterval(async () => {
      polls++;
      await fetchDocuments();
      if (polls > 40) clearInterval(pollInterval);
    }, 3000);
  };

  const deleteDocument = async (id: string) => {
    try {
      const res = await api.deleteDocument(parseInt(id));
      if (!res.error) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        if (selectedDoc?.id === id) setSelectedDoc(null);
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
      await api.reindexDocument(parseInt(id));
      let polls = 0;
      const pollInterval = setInterval(async () => {
        polls++;
        const progressRes = await api.getDocumentProgress(parseInt(id));
        if (progressRes.data) {
          const data = progressRes.data as any;
          if (data.stage === "completed" || data.stage === "failed") {
            clearInterval(pollInterval);
            await fetchDocuments();
          }
        }
        if (polls > 100) clearInterval(pollInterval);
      }, 3000);
    } catch (error) {
      console.error("Error reindexing document:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return {
    documents, searchQuery, setSearchQuery, selectedStatus, setSelectedStatus,
    isDragging, setIsDragging, showUploadModal, uploadProgress,
    selectedDoc, setSelectedDoc, isLoading,
    handleFiles, deleteDocument, reindexDocument, formatFileSize
  };
}
