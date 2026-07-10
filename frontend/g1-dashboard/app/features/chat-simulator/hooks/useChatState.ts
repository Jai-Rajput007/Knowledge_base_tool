import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Message } from "../types";

export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSources, setShowSources] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("llama3.2:latest");
  const [availableModels, setAvailableModels] = useState<string[]>(["llama3.2:latest", "mistral:latest", "gemma:2b"]);
  
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [sectionPath, setSectionPath] = useState("");
  const [parentSection, setParentSection] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [includeParentContext, setIncludeParentContext] = useState(true);

  const [contextStrategy, setContextStrategy] = useState<"hierarchy" | "relevance" | "chronological" | "compress" | "standard">("hierarchy");
  const [enableQueryProcessing, setEnableQueryProcessing] = useState(true);
  const [useExtractedFilters, setUseExtractedFilters] = useState(true);

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Load sessions
  const loadSessions = async () => {
    try {
      const res = await api.getSessions();
      if (res.data) setSessions(res.data as any[]);
    } catch (e) {}
  };
  
  useEffect(() => {
    loadSessions();
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await api.getAvailableModels();
        if (res.data) {
          const models = (res.data as { models?: { id: string; name: string }[] }).models || [];
          if (models.length > 0) {
            setAvailableModels(models.map(m => m.id));
            setSelectedModel(models[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      }
    };
    fetchModels();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (promptText?: string) => {
    const text = promptText || input;
    if (!text.trim() || isLoading) return;

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      try {
        const res = await api.createSession(text.substring(0, 50));
        if (res.data) {
          currentSessionId = (res.data as any).id;
          setActiveSessionId(currentSessionId);
          await loadSessions();
        }
      } catch (e) {}
    } else if (messages.length === 0) {
      try {
        await api.updateSession(currentSessionId, text.substring(0, 50));
        loadSessions(); // Update the sidebar title asynchronously
      } catch (e) {}
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await api.sendMessage(text, selectedDocIds.length > 0 ? selectedDocIds : undefined, {
        sessionId: currentSessionId || undefined,
        enableQueryProcessing,
        useExtractedFilters,
        sectionPath: sectionPath || undefined,
        parentSection: parentSection || undefined,
        includeParentContext,
        contentTypes: contentTypes.length > 0 ? contentTypes : undefined,
        contextStrategy,
      });
      
      if (res.error) {
        throw new Error(res.error);
      }

      const data = res.data as any;
      const response = data.message?.content || "No response received from the model.";
      const sources = data.sources || [];

      let currentContent = "";
      const chunkSize = 3;
      for (let i = 0; i < response.length; i += chunkSize) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentContent += response.slice(i, i + chunkSize);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: currentContent, sources: sources }
              : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: response, sources: sources, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get response";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Error: ${errorMessage}`, isStreaming: false }
            : msg
        )
      );
    }

    setIsLoading(false);
  };


  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    try {
      const res = await api.getSessionMessages(id);
      if (res.data) {
        setMessages((res.data as any[]).map((m: any) => ({
          id: m.id.toString(),
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at)
        })));
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await api.createSession("New Chat");
      if (res.data) {
        setActiveSessionId((res.data as any).id);
        await loadSessions();
      } else {
        setActiveSessionId(null);
      }
    } catch (e) {
      console.error("Failed to create new session", e);
      setActiveSessionId(null);
    }
    setMessages([]);
    setShowSources(null);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
      if (activeSessionId === id) handleNewChat();
      await loadSessions();
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setShowSources(null);
  };

  return {
    messages, input, setInput, isLoading, showSources, setShowSources,
    selectedModel, setSelectedModel, availableModels, messagesEndRef,
    showAdvancedOptions, setShowAdvancedOptions, sectionPath, setSectionPath,
    parentSection, setParentSection, contentTypes, setContentTypes,
    includeParentContext, setIncludeParentContext, contextStrategy, setContextStrategy,
    enableQueryProcessing, setEnableQueryProcessing, useExtractedFilters, setUseExtractedFilters,
    sendMessage, clearChat, selectedDocIds, setSelectedDocIds,
    sessions, activeSessionId, handleSelectSession, handleNewChat, handleDeleteSession
  };
}
