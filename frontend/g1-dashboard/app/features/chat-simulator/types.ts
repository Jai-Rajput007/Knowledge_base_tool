export interface Source {
    id: string;
    document: string;
    page?: number;
    excerpt: string;
    score: number;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
    isStreaming?: boolean;
    timestamp: Date;
}
