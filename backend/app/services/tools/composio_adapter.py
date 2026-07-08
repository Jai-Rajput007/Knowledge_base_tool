from typing import List, Dict, Any
from app.services.tools.base import BaseToolAdapter
from app.core.logging import logger
import json

class ComposioAdapter(BaseToolAdapter):
    """
    Adapter for Composio tools integration.
    """
    
    def __init__(self, api_key: str, user_id: str, apps: List[str] = None):
        try:
            from composio import Composio
            self.client = Composio(api_key=api_key)
            self.user_id = user_id
            self.apps = apps or []
            self.is_valid = True
            # Cache toolkit versions keyed by app slug so execute_tool can pass
            # the correct version (Composio requires an explicit version for manual execution)
            self._toolkit_versions: Dict[str, str] = {}
            self._fetch_toolkit_versions()
        except ImportError:
            logger.error("[ComposioAdapter] composio SDK not installed. Please pip install composio")
            self.is_valid = False
            self.client = None
            self.user_id = None
            self.apps = []
            self._toolkit_versions = {}

    def _fetch_toolkit_versions(self):
        """Pre-fetch and cache the current version of each connected toolkit."""
        for app in self.apps:
            try:
                # Fetch 1 tool; the version is embedded in the tool's metadata or we
                # fall back to dangerously_skip_version_check at execute time.
                # Composio's recommended approach when version is unknown:
                # set COMPOSIO_TOOLKIT_VERSION_<SLUG> env var OR skip check.
                # We try to read the env var first, otherwise skip.
                import os
                env_key = f"COMPOSIO_TOOLKIT_VERSION_{app.upper()}"
                ver = os.environ.get(env_key)
                if ver:
                    self._toolkit_versions[app] = ver
                    logger.info(f"[ComposioAdapter] Using pinned version '{ver}' for toolkit '{app}' from env")
            except Exception as e:
                logger.warning(f"[ComposioAdapter] Could not fetch version for toolkit '{app}': {e}")

    @property
    def provider_id(self) -> str:
        return "composio"

    @staticmethod
    def _extract_keywords(query: str) -> str:
        """
        Extract short actionable keywords from a NL query for Composio tool search.
        Composio's search matches tool NAMES/DESCRIPTIONS (not NL semantics),
        so we strip filler words and keep domain-relevant nouns/verbs.
        e.g. "Can you get the details of my GitHub profile?" → "get details profile"
        """
        import re
        stop = {
            'can', 'you', 'please', 'my', 'the', 'a', 'an', 'of', 'to',
            'and', 'or', 'in', 'on', 'at', 'with', 'this', 'me', 'it',
            'did', 'have', 'has', 'is', 'are', 'for', 'your', 'their',
            'some', 'any', 'all', 'just', 'also', 'from', 'that'
        }
        clean = re.sub(r'[^\w\s]', ' ', query.lower())
        words = [w for w in clean.split() if w not in stop and len(w) > 2]
        return ' '.join(words[:5])

    async def get_tools(self, query: str = None) -> List[Dict[str, Any]]:
        if not self.is_valid or not self.client or not self.apps:
            return []

        try:
            from qdrant_client import QdrantClient, models
            from app.services.embedding_service_optimized import OllamaEmbeddingProvider
            import json
            
            qdrant = QdrantClient(path="./qdrant_db")
            embedder = OllamaEmbeddingProvider()
            
            all_tools = []
            seen_names = set()
            
            # Step 1: If we have a query, use Qdrant for semantic search
            if query:
                try:
                    # Embed the query
                    query_embedding = embedder.embed([query])[0]
                    
                    # Create filter for composio + enabled apps
                    query_filter = models.Filter(
                        must=[
                            models.FieldCondition(
                                key="provider",
                                match=models.MatchValue(value="composio")
                            ),
                            models.FieldCondition(
                                key="app_name",
                                match=models.MatchAny(any=self.apps)
                            )
                        ]
                    )
                    
                    # Search Qdrant
                    results = qdrant.search(
                        collection_name="global_tools",
                        query_vector=query_embedding,
                        query_filter=query_filter,
                        limit=15,
                        with_payload=True
                    )
                    
                    for r in results:
                        payload = r.payload
                        if not payload or not payload.get("schema"):
                            continue
                            
                        schema_str = payload["schema"]
                        try:
                            schema = json.loads(schema_str)
                            name = schema.get("name")
                            if name and name not in seen_names:
                                seen_names.add(name)
                                # OpenAI format requires the schema nested under "function", and type="function"
                                all_tools.append({
                                    "type": "function",
                                    "function": schema
                                })
                        except Exception as e:
                            logger.error(f"[ComposioAdapter] Error parsing schema from Qdrant: {e}")
                            
                    logger.info(f"[ComposioAdapter] RAG returned {len(all_tools)} tools for query '{query}'")
                except Exception as e:
                    logger.error(f"[ComposioAdapter] Qdrant search failed: {e}")
                    
            # Step 2: Fallback to exact hints if RAG missed obvious ones
            if query:
                EXACT_TOOL_HINTS = {
                    'profile': ['GET_THE_AUTHENTICATED_USER'],
                    'username': ['GET_THE_AUTHENTICATED_USER'],
                    'me': ['GET_THE_AUTHENTICATED_USER'],
                    'repositories': ['LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER', 'LIST_PUBLIC_REPOSITORIES'],
                    'repos': ['LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER'],
                    'list': ['LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER'],
                    'starred': ['LIST_REPOSITORIES_STARRED_BY_THE_AUTHENTICATED_USER'],
                    'star': ['LIST_REPOSITORIES_STARRED_BY_THE_AUTHENTICATED_USER'],
                    'notification': ['LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER', 'GET_A_THREAD'],
                    'notifications': ['LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER'],
                    'issues': ['LIST_ISSUES_ASSIGNED_TO_THE_AUTHENTICATED_USER'],
                    'pull': ['LIST_PULL_REQUESTS'],
                    'pr': ['LIST_PULL_REQUESTS'],
                    'commit': ['LIST_COMMITS'],
                    'commits': ['LIST_COMMITS'],
                }
                
                exact_actions = set()
                for word in query.lower().split():
                    clean_word = word.rstrip('?.,!')
                    if clean_word in EXACT_TOOL_HINTS:
                        for app in self.apps:
                            for action in EXACT_TOOL_HINTS[clean_word]:
                                exact_actions.add(f"{app.upper()}_{action}")

                if exact_actions:
                    try:
                        hint_tools = self.client.tools.get(
                            user_id=self.user_id,
                            tools=list(exact_actions)
                        )
                        for t in hint_tools:
                            d = t if isinstance(t, dict) else (t.model_dump() if hasattr(t, 'model_dump') else None)
                            if d:
                                name = d.get('function', {}).get('name')
                                if name and name not in seen_names:
                                    seen_names.add(name)
                                    all_tools.insert(0, d)
                    except Exception as e:
                        logger.error(f"[ComposioAdapter] Exact hint fetch failed: {e}")
                        
            # Step 3: If no query or RAG failed, fallback to baseline directly from Composio
            baseline_needed = max(0, 10 - len(all_tools))
            if baseline_needed > 0:
                for app in self.apps:
                    if baseline_needed <= 0:
                        break
                    try:
                        base = self.client.tools.get(
                            user_id=self.user_id,
                            toolkits=[app],
                            limit=baseline_needed
                        )
                        for t in base:
                            d = t if isinstance(t, dict) else (t.model_dump() if hasattr(t, 'model_dump') else None)
                            if d:
                                name = d.get('function', {}).get('name')
                                if name and name not in seen_names:
                                    seen_names.add(name)
                                    all_tools.append(d)
                                    baseline_needed -= 1
                    except Exception as e:
                        logger.error(f"[ComposioAdapter] Baseline fetch failed for {app}: {e}")

            logger.info(f"[ComposioAdapter] Total: {len(all_tools)} tools returned")
            return all_tools

        except Exception as e:
            logger.error(f"[ComposioAdapter] Failed to get tools: {e}")
            return []

    async def execute_tool(self, name: str, arguments: dict) -> str:
        if not self.is_valid or not self.client:
            return "Error: Composio adapter is not properly initialized."

        logger.info(f"[ComposioAdapter] Executing tool '{name}'")
        try:
            # Determine which app this tool belongs to (slug prefix, e.g. GITHUB_* → github)
            # so we can pass the cached toolkit version if available.
            app_slug = name.split('_')[0].lower() if '_' in name else None
            pinned_version = self._toolkit_versions.get(app_slug) if app_slug else None

            execute_kwargs = {
                "slug": name,
                "arguments": arguments,
                "user_id": self.user_id,
            }

            if pinned_version:
                execute_kwargs["version"] = pinned_version
                logger.info(f"[ComposioAdapter] Using pinned version '{pinned_version}' for '{name}'")
            else:
                # No version pinned — use dangerously_skip_version_check.
                # This is safe in practice: it just means Composio won't validate
                # that the tool schema matches the pinned version.
                execute_kwargs["dangerously_skip_version_check"] = True

            response = self.client.tools.execute(**execute_kwargs)

            # Return stringified response
            if hasattr(response, "data"):
                return json.dumps(response.data)
            return str(response)
        except Exception as e:
            logger.error(f"[ComposioAdapter] Tool execution failed: {e}")
            return f"Error executing {name}: {str(e)}"
