"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useChatState } from "./hooks/useChatState";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { ChatSidebar } from "./components/ChatSidebar";

export function ChatSimulatorModule() {
  const {
    messages, input, setInput, isLoading, showSources, setShowSources,
    selectedModel, setSelectedModel, availableModels, messagesEndRef,
    showAdvancedOptions, setShowAdvancedOptions, sectionPath, setSectionPath,
    parentSection, setParentSection, contentTypes, setContentTypes,
    includeParentContext, setIncludeParentContext, contextStrategy, setContextStrategy,
    enableQueryProcessing, setEnableQueryProcessing, useExtractedFilters, setUseExtractedFilters,
    sendMessage, clearChat, sessions, activeSessionId, handleSelectSession, handleNewChat, handleDeleteSession
  } = useChatState();

  const hasActiveFilters = Boolean(sectionPath || parentSection || contentTypes.length > 0);

  return (
    <FeatureGate featureKey="chatSimulator">
      <div className="flex-1 flex bg-background h-[calc(100vh-7rem)]">
        <ChatSidebar 
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
        />
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full border-x border-border">
          <ChatHeader
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            availableModels={availableModels}
            messages={messages}
            clearChat={clearChat}
          />

          <MessageList
            messages={messages}
            showSources={showSources}
            setShowSources={setShowSources}
            sendMessage={sendMessage}
            messagesEndRef={messagesEndRef}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            sendMessage={sendMessage}
          />
        </div>
      </div>
    </FeatureGate>
  );
}
