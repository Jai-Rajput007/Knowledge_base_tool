"""LLM service for chat completion."""

from typing import List, Optional, Dict, Any, AsyncGenerator
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMError


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate chat completion."""
        pass
    
    @abstractmethod
    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion."""
        pass


class OllamaProvider(LLMProvider):
    """Ollama LLM provider."""
    
    def __init__(self, model: str = None):
        self.model = model or settings.LLM_MODEL
        self.base_url = "http://localhost:11434"
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.top_p = settings.LLM_TOP_P
    
    def chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate chat completion with Ollama."""
        try:
            import ollama
            
            response = ollama.chat(
                model=self.model,
                messages=messages,
                options={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "num_predict": kwargs.get("max_tokens", self.max_tokens),
                    "top_p": kwargs.get("top_p", self.top_p),
                }
            )
            
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama chat failed: {str(e)}")
            raise LLMError(f"Ollama chat failed: {str(e)}")
    
    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion with Ollama."""
        try:
            import ollama
            
            stream = ollama.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "num_predict": kwargs.get("max_tokens", self.max_tokens),
                    "top_p": kwargs.get("top_p", self.top_p),
                }
            )
            
            for chunk in stream:
                if "message" in chunk and "content" in chunk["message"]:
                    yield chunk["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama streaming failed: {str(e)}")
            raise LLMError(f"Ollama streaming failed: {str(e)}")


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider."""
    
    def __init__(self, model: str = "gpt-3.5-turbo"):
        self.model = model
        self.api_key = settings.OPENAI_API_KEY
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.top_p = settings.LLM_TOP_P
    
    def chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate chat completion with OpenAI."""
        if not self.api_key:
            raise LLMError("OpenAI API key not configured")
        
        try:
            import openai
            openai.api_key = self.api_key
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
                top_p=kwargs.get("top_p", self.top_p),
            )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI chat failed: {str(e)}")
            raise LLMError(f"OpenAI chat failed: {str(e)}")
    
    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion with OpenAI."""
        if not self.api_key:
            raise LLMError("OpenAI API key not configured")
        
        try:
            import openai
            openai.api_key = self.api_key
            
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
                top_p=kwargs.get("top_p", self.top_p),
                stream=True,
            )
            
            for chunk in response:
                if chunk.choices[0].delta.get("content"):
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"OpenAI streaming failed: {str(e)}")
            raise LLMError(f"OpenAI streaming failed: {str(e)}")


class LLMService:
    """Main LLM service."""
    
    def __init__(self):
        self.provider: LLMProvider = self._create_provider()
    
    def _create_provider(self) -> LLMProvider:
        """Create LLM provider based on settings."""
        provider_type = settings.LLM_PROVIDER.lower()
        
        if provider_type == "ollama":
            return OllamaProvider()
        elif provider_type == "openai":
            return OpenAIProvider()
        else:
            logger.warning(f"Unknown provider {provider_type}, defaulting to Ollama")
            return OllamaProvider()
    
    def chat(
        self,
        user_message: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate chat completion with optional RAG context."""
        
        system = system_prompt or settings.LLM_SYSTEM_PROMPT
        
        # Build messages
        messages = [
            {"role": "system", "content": system}
        ]
        
        # Add context if provided
        if context:
            messages.append({
                "role": "system",
                "content": f"Use the following context to answer the user's question:\n\n{context}"
            })
        
        messages.append({"role": "user", "content": user_message})
        
        logger.info(f"Generating chat completion")
        return self.provider.chat(messages)
    
    async def chat_stream(
        self,
        user_message: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion."""
        
        system = system_prompt or settings.LLM_SYSTEM_PROMPT
        
        # Build messages
        messages = [
            {"role": "system", "content": system}
        ]
        
        if context:
            messages.append({
                "role": "system",
                "content": f"Use the following context to answer the user's question:\n\n{context}"
            })
        
        messages.append({"role": "user", "content": user_message})
        
        logger.info(f"Generating streaming chat completion")
        async for chunk in self.provider.chat_stream(messages):
            yield chunk


# Global service instance
llm_service = LLMService()
