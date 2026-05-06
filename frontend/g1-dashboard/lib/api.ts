/* API client for backend communication. */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Network error" };
    }
  }

  // Health check
  async healthCheck() {
    return this.request("/health");
  }

  // Dashboard
  async getDashboardStats() {
    return this.request("/dashboard/stats");
  }

  async getRecentDocuments() {
    return this.request("/dashboard/recent-documents");
  }

  async getRecentActivities() {
    return this.request("/dashboard/recent-activities");
  }

  async getModelStatus() {
    return this.request("/dashboard/models");
  }

  // Documents
  async getDocuments() {
    return this.request("/documents/");
  }

  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${this.baseUrl}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Upload failed" };
    }
  }

  async deleteDocument(id: number) {
    return this.request(`/documents/${id}`, { method: "DELETE" });
  }

  async reindexDocument(id: number) {
    return this.request(`/documents/${id}/reindex`, { method: "POST" });
  }

  async getDocumentContent(id: number) {
    return this.request(`/documents/${id}/content`);
  }

  async getDocumentProgress(id: number) {
    return this.request(`/documents/${id}/progress`);
  }

  async getSupportedFormats() {
    return this.request("/documents/supported-formats");
  }

  async getDocumentStats() {
    return this.request("/documents/stats/summary");
  }

  // Chat
  async sendMessage(
    message: string,
    documentIds?: number[],
    options?: {
      // Query processing
      enableQueryProcessing?: boolean;
      useExtractedFilters?: boolean;
      // Hierarchy
      sectionPath?: string;
      parentSection?: string;
      headingLevel?: number;
      includeParentContext?: boolean;
      // Content type
      contentTypes?: string[];
      // Metadata
      metadataFilters?: Record<string, any>;
      // Context building
      contextStrategy?: "standard" | "hierarchy" | "relevance" | "chronological" | "compress";
      includeMetadataInContext?: boolean;
      includeHierarchyInContext?: boolean;
    }
  ) {
    return this.request("/chat/", {
      method: "POST",
      body: JSON.stringify({
        message,
        document_ids: documentIds,
        enable_query_processing: options?.enableQueryProcessing ?? true,
        use_extracted_filters: options?.useExtractedFilters ?? true,
        section_path: options?.sectionPath,
        parent_section: options?.parentSection,
        heading_level: options?.headingLevel,
        include_parent_context: options?.includeParentContext ?? true,
        content_types: options?.contentTypes,
        metadata_filters: options?.metadataFilters,
        context_strategy: options?.contextStrategy ?? "hierarchy",
        include_metadata_in_context: options?.includeMetadataInContext ?? true,
        include_hierarchy_in_context: options?.includeHierarchyInContext ?? true,
      }),
    });
  }

  async sendMessageStream(
    message: string,
    documentIds?: number[],
    options?: {
      // Query processing
      enableQueryProcessing?: boolean;
      useExtractedFilters?: boolean;
      // Hierarchy
      sectionPath?: string;
      parentSection?: string;
      headingLevel?: number;
      includeParentContext?: boolean;
      // Content type
      contentTypes?: string[];
      // Metadata
      metadataFilters?: Record<string, any>;
      // Context building
      contextStrategy?: "standard" | "hierarchy" | "relevance" | "chronological" | "compress";
      includeMetadataInContext?: boolean;
      includeHierarchyInContext?: boolean;
    }
  ) {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        document_ids: documentIds,
        enable_query_processing: options?.enableQueryProcessing ?? true,
        use_extracted_filters: options?.useExtractedFilters ?? true,
        section_path: options?.sectionPath,
        parent_section: options?.parentSection,
        heading_level: options?.headingLevel,
        include_parent_context: options?.includeParentContext ?? true,
        content_types: options?.contentTypes,
        metadata_filters: options?.metadataFilters,
        context_strategy: options?.contextStrategy ?? "hierarchy",
        include_metadata_in_context: options?.includeMetadataInContext ?? true,
        include_hierarchy_in_context: options?.includeHierarchyInContext ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  }

  async getAvailableModels() {
    return this.request("/chat/models");
  }

  // Settings
  async getSettings() {
    return this.request("/settings/");
  }

  async updateSettings(settings: Record<string, any>) {
    return this.request("/settings/", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
