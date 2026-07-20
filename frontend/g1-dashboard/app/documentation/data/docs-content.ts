export interface DocSection {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  keywords: string[];
}

export const docCategories = [
  {
    id: "core",
    name: "Core Platform",
    sections: ["getting-started", "dashboard"],
  },
  {
    id: "ai-persona",
    name: "AI & Persona",
    sections: ["persona-engine", "generative-persona", "persona-library", "knowledge-base"],
  },
  {
    id: "robot-control",
    name: "Robot Control",
    sections: ["facial-recognition", "navigation-mapping", "gesture-library", "custom-wakewords"],
  },
  {
    id: "integrations",
    name: "Integrations",
    sections: ["mcp-integrations"],
  },
  {
    id: "monitoring",
    name: "Monitoring",
    sections: ["chat-simulator", "audit-log"],
  },
  {
    id: "settings",
    name: "Settings",
    sections: ["general-settings", "security-settings", "voice-settings", "advanced-settings"],
  },
];

export const docsContent: DocSection[] = [
  // Category: Core Platform
  {
    id: "getting-started",
    categoryId: "core",
    categoryName: "Core Platform",
    title: "Getting Started",
    keywords: ["start", "introduction", "requirements", "setup", "login", "veda"],
  },
  {
    id: "dashboard",
    categoryId: "core",
    categoryName: "Core Platform",
    title: "Dashboard",
    keywords: ["dashboard", "overview", "status", "health", "metrics", "preview panel", "agx", "robot hardware"],
  },
  // Category: AI & Persona
  {
    id: "persona-engine",
    categoryId: "ai-persona",
    categoryName: "AI & Persona",
    title: "Persona Engine",
    keywords: ["persona", "identity", "voice", "system prompt", "rules", "deploy", "active"],
  },
  {
    id: "generative-persona",
    categoryId: "ai-persona",
    categoryName: "AI & Persona",
    title: "Generative Persona",
    keywords: ["generative", "ai", "ollama", "auto-generate", "prompt", "create persona"],
  },
  {
    id: "persona-library",
    categoryId: "ai-persona",
    categoryName: "AI & Persona",
    title: "Persona Library",
    keywords: ["library", "saved personas", "switch persona", "history", "versions"],
  },
  {
    id: "knowledge-base",
    categoryId: "ai-persona",
    categoryName: "AI & Persona",
    title: "Knowledge Base (RAG)",
    keywords: ["rag", "knowledge", "documents", "pdf", "docx", "txt", "upload", "index", "chunk", "embed", "re-index"],
  },
  // Category: Robot Control
  {
    id: "facial-recognition",
    categoryId: "robot-control",
    categoryName: "Robot Control",
    title: "Facial Recognition (FRS)",
    keywords: ["frs", "facial recognition", "face", "employees", "profiles", "access", "context", "csv", "bulk"],
  },
  {
    id: "navigation-mapping",
    categoryId: "robot-control",
    categoryName: "Robot Control",
    title: "Navigation & Mapping",
    keywords: ["navigation", "mapping", "slam", "locations", "go", "move", "robot"],
  },
  {
    id: "gesture-library",
    categoryId: "robot-control",
    categoryName: "Robot Control",
    title: "Gesture Library",
    keywords: ["gestures", "custom gestures", "record", "play", "arm", "movements", "npy"],
  },
  {
    id: "custom-wakewords",
    categoryId: "robot-control",
    categoryName: "Robot Control",
    title: "Custom Wakewords",
    keywords: ["wakeword", "trigger", "hey veda", "hey g1", "train", "kaggle", "voice", "audio"],
  },
  // Category: Integrations
  {
    id: "mcp-integrations",
    categoryId: "integrations",
    categoryName: "Integrations",
    title: "Integrations (MCP)",
    keywords: ["mcp", "integrations", "tools", "google", "calendar", "drive", "gmail", "composio", "oauth"],
  },
  // Category: Monitoring
  {
    id: "chat-simulator",
    categoryId: "monitoring",
    categoryName: "Monitoring",
    title: "Chat Simulator",
    keywords: ["chat", "simulator", "test", "messages", "turns", "sessions", "history"],
  },
  {
    id: "audit-log",
    categoryId: "monitoring",
    categoryName: "Monitoring",
    title: "Audit Log",
    keywords: ["audit", "logs", "activity", "actions", "compliance", "history", "admin"],
  },
  // Category: Settings
  {
    id: "general-settings",
    categoryId: "settings",
    categoryName: "Settings",
    title: "General Settings",
    keywords: ["settings", "general", "auto-save", "sources", "streaming", "dark mode", "theme"],
  },
  {
    id: "security-settings",
    categoryId: "settings",
    categoryName: "Settings",
    title: "Security Settings",
    keywords: ["security", "password", "users", "admin", "rbac", "roles", "api keys", "access"],
  },
  {
    id: "voice-settings",
    categoryId: "settings",
    categoryName: "Settings",
    title: "Voice Settings",
    keywords: ["voice", "tts", "text to speech", "robot voice", "audio"],
  },
  {
    id: "advanced-settings",
    categoryId: "settings",
    categoryName: "Settings",
    title: "Advanced Settings",
    keywords: ["advanced", "embedding", "chunking", "vector db", "pgvector", "ota", "updates", "rollback", "firmware"],
  },
];
