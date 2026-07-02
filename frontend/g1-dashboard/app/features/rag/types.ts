export type DocumentStatus = "uploaded" | "processing" | "indexed" | "error";

export interface Document {
    id: string;
    name: string;
    size: string;
    type: string;
    status: DocumentStatus;
    uploadedAt: string;
    chunks?: number;
    error?: string;
}
