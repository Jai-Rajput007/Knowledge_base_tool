"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useChatState } from "./hooks/useChatState";
import { ChatHeader } from "./components/ChatHeader";
import { AdvancedSearchOptions } from "./components/AdvancedSearchOptions";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";

export function ChatSimulatorModule() {
  const {
    messages, input, setInput, isLoading, showSources, setShowSources,
    selectedModel, setSelectedModel, availableModels, messagesEndRef,
    showAdvancedOptions, setShowAdvancedOptions, sectionPath, setSectionPath,
    parentSection, setParentSection, contentTypes, setContentTypes,
    includeParentContext, setIncludeParentContext, contextStrategy, setContextStrategy,
    enableQueryProcessing, setEnableQueryProcessing, useExtractedFilters, setUseExtractedFilters,
    sendMessage, clearChat
  } = useChatState();

  const hasActiveFilters = Boolean(sectionPath || parentSection || contentTypes.length > 0);

  return (
    <FeatureGate featureKey="chatSimulator">
      <div className="flex-1 flex bg-background h-[calc(100vh-7rem)]">
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full border-x border-border">
          <ChatHeader
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            availableModels={availableModels}
            messages={messages}
            clearChat={clearChat}
            showAdvancedOptions={showAdvancedOptions}
            setShowAdvancedOptions={setShowAdvancedOptions}
            hasActiveFilters={hasActiveFilters}
          />

          <AdvancedSearchOptions
            showAdvancedOptions={showAdvancedOptions}
            sectionPath={sectionPath}
            setSectionPath={setSectionPath}
            parentSection={parentSection}
            setParentSection={setParentSection}
            contentTypes={contentTypes}
            setContentTypes={setContentTypes}
            includeParentContext={includeParentContext}
            setIncludeParentContext={setIncludeParentContext}
            contextStrategy={contextStrategy}
            setContextStrategy={setContextStrategy}
            enableQueryProcessing={enableQueryProcessing}
            setEnableQueryProcessing={setEnableQueryProcessing}
            useExtractedFilters={useExtractedFilters}
            setUseExtractedFilters={setUseExtractedFilters}
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
