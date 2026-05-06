"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "w-11 h-6 rounded-full relative transition-colors cursor-pointer",
        checked ? "bg-primary" : "bg-accent"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full absolute top-0.5 transition-all bg-white",
          checked ? "right-0.5" : "left-0.5"
        )}
      />
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // General Settings State
  const [autoSave, setAutoSave] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [darkModeDefault, setDarkModeDefault] = useState(false);

  // LLM Settings State
  const [llmProvider, setLlmProvider] = useState("ollama");
  const [llmModel, setLlmModel] = useState("llama3.2:latest");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(0.9);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant. Answer questions based on the provided context.");

  // Embedding Settings State
  const [embeddingModel, setEmbeddingModel] = useState("nomic-embed-text:latest");
  const [embeddingProvider, setEmbeddingProvider] = useState("ollama");
  const [embeddingDimension, setEmbeddingDimension] = useState(768);

  // Chunking Settings State
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [chunkingStrategy, setChunkingStrategy] = useState("semantic");
  const [batchSize, setBatchSize] = useState(32);

  // Vector DB Settings State
  const [vectorDb, setVectorDb] = useState("chroma");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [topK, setTopK] = useState(5);

  // API Keys State
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [cohereKey, setCohereKey] = useState("");

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSettings();
      if (res.data) {
        const settings = res.data as Record<string, any>;
        // Update all settings from API
        if (settings.llm_provider) setLlmProvider(settings.llm_provider);
        if (settings.llm_model) setLlmModel(settings.llm_model);
        if (settings.temperature !== undefined) setTemperature(settings.temperature);
        if (settings.max_tokens) setMaxTokens(settings.max_tokens);
        if (settings.top_p !== undefined) setTopP(settings.top_p);
        if (settings.system_prompt) setSystemPrompt(settings.system_prompt);
        if (settings.embedding_provider) setEmbeddingProvider(settings.embedding_provider);
        if (settings.embedding_model) setEmbeddingModel(settings.embedding_model);
        if (settings.embedding_dimensions) setEmbeddingDimension(settings.embedding_dimensions);
        if (settings.chunk_size) setChunkSize(settings.chunk_size);
        if (settings.chunk_overlap !== undefined) setChunkOverlap(settings.chunk_overlap);
        if (settings.chunking_strategy) setChunkingStrategy(settings.chunking_strategy);
        if (settings.batch_size) setBatchSize(settings.batch_size);
        if (settings.vector_db_type) setVectorDb(settings.vector_db_type);
        if (settings.similarity_threshold !== undefined) setSimilarityThreshold(settings.similarity_threshold);
        if (settings.top_k) setTopK(settings.top_k);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaveStatus("saving");
    try {
      const settings = {
        llm_provider: llmProvider,
        llm_model: llmModel,
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system_prompt: systemPrompt,
        embedding_provider: embeddingProvider,
        embedding_model: embeddingModel,
        embedding_dimensions: embeddingDimension,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        chunking_strategy: chunkingStrategy,
        batch_size: batchSize,
        vector_db_type: vectorDb,
        similarity_threshold: similarityThreshold,
        top_k: topK,
        openai_api_key: openaiKey || undefined,
        anthropic_api_key: anthropicKey || undefined,
        cohere_api_key: cohereKey || undefined,
      };

      const res = await api.updateSettings(settings);
      if (!res.error) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: "llm", label: "LLM Models", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
    { id: "embedding", label: "Embedding", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
    { id: "chunking", label: "Chunking", icon: "M4 7v10c0 2 1.5 3 3 3h10c1.5 0 3-1 3-3V7c0-2-1.5-3-3-3H7c-1.5 0-3 1-3 3z M9 12h6" },
    { id: "database", label: "Vector DB", icon: "M4 7v10c0 2 1.5 3 3 3h10c1.5 0 3-1 3-3V7c0-2-1.5-3-3-3H7c-1.5 0-3 1-3 3z" },
    { id: "api", label: "API Keys", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
  ];

  return (
    <div className="flex-1 p-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Settings</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-52 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "general" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">General Settings</h2>
                  <p className="text-muted-foreground">Configure system-wide preferences</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-border">
                    <div>
                      <p className="font-medium text-card-foreground">Auto-save conversations</p>
                      <p className="text-sm text-muted-foreground">Automatically save chat history</p>
                    </div>
                    <Toggle checked={autoSave} onChange={() => setAutoSave(!autoSave)} />
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-border">
                    <div>
                      <p className="font-medium text-card-foreground">Show source citations</p>
                      <p className="text-sm text-muted-foreground">Display document references in AI responses</p>
                    </div>
                    <Toggle checked={showSources} onChange={() => setShowSources(!showSources)} />
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-border">
                    <div>
                      <p className="font-medium text-card-foreground">Enable streaming responses</p>
                      <p className="text-sm text-muted-foreground">Stream AI responses in real-time</p>
                    </div>
                    <Toggle checked={streamingEnabled} onChange={() => setStreamingEnabled(!streamingEnabled)} />
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-card-foreground">Default to dark mode</p>
                      <p className="text-sm text-muted-foreground">Use dark theme by default</p>
                    </div>
                    <Toggle checked={darkModeDefault} onChange={() => setDarkModeDefault(!darkModeDefault)} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "llm" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">LLM Configuration</h2>
                  <p className="text-muted-foreground">Configure your language model settings</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Provider</label>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="cohere">Cohere</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Model</label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="llama3.2:latest">Llama 3.2</option>
                      <option value="mistral:latest">Mistral</option>
                      <option value="gemma:2b">Gemma 2B</option>
                      <option value="phi3:latest">Phi-3</option>
                      <option value="codellama:latest">Code Llama</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Temperature ({temperature})</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Controls randomness: 0 = deterministic, 2 = very random</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Max Tokens</label>
                    <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      min="128"
                      max="8192"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Top P ({topP})</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">System Prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === "embedding" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">Embedding Configuration</h2>
                  <p className="text-muted-foreground">Configure document embedding settings</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Provider</label>
                    <select
                      value={embeddingProvider}
                      onChange={(e) => setEmbeddingProvider(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai">OpenAI</option>
                      <option value="cohere">Cohere</option>
                      <option value="huggingface">Hugging Face</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Embedding Model</label>
                    <select
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="nomic-embed-text:latest">Nomic Embed Text</option>
                      <option value="all-minilm:latest">All-MiniLM</option>
                      <option value="mxbai-embed-large:latest">MXBAI Embed Large</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Dimensions</label>
                    <input
                      type="number"
                      value={embeddingDimension}
                      onChange={(e) => setEmbeddingDimension(parseInt(e.target.value))}
                      min="128"
                      max="4096"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chunking" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">Chunking Configuration</h2>
                  <p className="text-muted-foreground">Configure how documents are split for indexing</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Chunking Strategy</label>
                    <select
                      value={chunkingStrategy}
                      onChange={(e) => setChunkingStrategy(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="semantic">Semantic (Recommended)</option>
                      <option value="fixed">Fixed Size</option>
                      <option value="recursive">Recursive</option>
                      <option value="markdown">Markdown Headers</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Batch Size</label>
                    <input
                      type="number"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">Chunks to process in parallel</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Chunk Size ({chunkSize} tokens)</label>
                    <input
                      type="range"
                      min="128"
                      max="2048"
                      step="64"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>128</span>
                      <span>2048</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Chunk Overlap ({chunkOverlap} tokens)</label>
                    <input
                      type="range"
                      min="0"
                      max="256"
                      step="16"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0</span>
                      <span>256</span>
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-xl p-4 border border-border">
                  <p className="text-sm text-card-foreground font-medium mb-1">Estimated chunks per document</p>
                  <p className="text-sm text-muted-foreground">
                    A 5000 token document will create approximately {Math.ceil(5000 / (chunkSize - chunkOverlap))} chunks with these settings.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "database" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">Vector Database</h2>
                  <p className="text-muted-foreground">Configure vector search and storage</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Vector Database</label>
                    <select
                      value={vectorDb}
                      onChange={(e) => setVectorDb(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="chroma">ChromaDB</option>
                      <option value="qdrant">Qdrant</option>
                      <option value="pinecone">Pinecone</option>
                      <option value="weaviate">Weaviate</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Top K Results ({topK})</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Number of chunks to retrieve</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Similarity Threshold ({similarityThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={similarityThreshold}
                      onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Minimum similarity score (0 = all results, 1 = exact matches only)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-4 border-t border-border">
                  <div>
                    <p className="font-medium text-card-foreground">Auto-optimize indices</p>
                    <p className="text-sm text-muted-foreground">Automatically optimize vector indices periodically</p>
                  </div>
                  <Toggle checked={true} onChange={() => {}} />
                </div>
              </div>
            )}

            {activeTab === "api" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-1">API Keys</h2>
                  <p className="text-muted-foreground">Manage your API credentials for external services</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">OpenAI API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Required for OpenAI models and embeddings</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Anthropic API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={anthropicKey}
                        onChange={(e) => setAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Required for Claude models</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Cohere API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={cohereKey}
                        onChange={(e) => setCohereKey(e.target.value)}
                        placeholder="..."
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Required for Cohere models and embeddings</p>
                  </div>
                </div>

                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                  <p className="text-sm text-blue-600 font-medium mb-1">Security Note</p>
                  <p className="text-sm text-muted-foreground">
                    API keys are stored locally and never sent to our servers. They are only used for making requests to the respective AI providers.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8">
          <button
            onClick={saveSettings}
            disabled={saveStatus === "saving"}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2",
              saveStatus === "saving"
                ? "bg-muted text-muted-foreground cursor-wait"
                : saveStatus === "saved"
                ? "bg-green-500 text-white"
                : saveStatus === "error"
                ? "bg-red-500 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {saveStatus === "saving" ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : saveStatus === "error" ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Error Saving
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
