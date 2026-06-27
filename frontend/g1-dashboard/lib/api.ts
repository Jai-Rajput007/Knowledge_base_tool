/* API client for backend communication. */

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    // Determine backend URL from the frontend's host but port 8000
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return "http://localhost:8000/api/v1";
};

const API_BASE_URL = getApiUrl();

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
  }

  getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  removeToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: "POST",
      headers,
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

  // Auth
  async loginUser(userData: { username: string; password: string }) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser() {
    return this.request("/auth/me");
  }

  // Admin: user management
  async listUsers() {
    return this.request("/auth/users");
  }

  async createUser(userData: { username: string; email: string; password: string; role: "admin" | "user" }) {
    return this.request("/auth/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, data: { email?: string; role?: string; is_active?: number; password?: string }) {
    return this.request(`/auth/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/auth/users/${userId}`, { method: "DELETE" });
  }

  async forgotPassword(email: string) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email: string, new_password: string) {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, new_password }),
    });
  }

  async registerUser(_userData: { username: string; email: string; password: string }) {
    return { error: "Registration is disabled. Contact your administrator." };
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async listEmployees() {
    return this.request<any[]>("/employees/");
  }

  async createEmployee(formData: FormData) {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const response = await fetch(`${this.baseUrl}/employees/`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        return { error };
      }
      return { data: await response.json() };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async addEmployeePhotos(employeeId: string, formData: FormData) {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const response = await fetch(`${this.baseUrl}/employees/${employeeId}/photos`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        return { error };
      }
      return { data: await response.json() };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async deleteEmployee(employeeId: string) {
    return this.request(`/employees/${employeeId}`, { method: "DELETE" });
  }

  async bulkImportEmployees(formData: FormData) {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const response = await fetch(`${this.baseUrl}/employees/bulk`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        return { error };
      }
      return { data: await response.json() };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}

export const api = new ApiClient(API_BASE_URL);
