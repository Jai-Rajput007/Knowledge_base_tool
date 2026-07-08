import os
import sys
import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient, models
from composio import Composio

# We use the optimized embedding service
from app.services.embedding_service_optimized import OllamaEmbeddingProvider
from app.core.config import settings

# Configuration
QDRANT_PATH = "./qdrant_db"
COLLECTION_NAME = "global_tools"
COMPOSIO_API_KEY = "ak_HlT2qEnTnTXF1OGcHMEG"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def init_qdrant() -> QdrantClient:
    client = QdrantClient(path=QDRANT_PATH)
    collections = [c.name for c in client.get_collections().collections]
    
    if COLLECTION_NAME not in collections:
        logger.info(f"Creating collection '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=settings.EMBEDDING_DIMENSIONS,
                distance=models.Distance.COSINE
            )
        )
    else:
        logger.info(f"Collection '{COLLECTION_NAME}' already exists.")
    return client

async def fetch_composio_tools():
    """Fetch all tools from Composio."""
    logger.info("Initializing Composio client...")
    client = Composio(api_key=COMPOSIO_API_KEY)
    
    logger.info("Fetching Composio toolkits...")
    try:
        tks_res = client.toolkits.list()
        items = getattr(tks_res, 'items', [])
        logger.info(f"Found {len(items)} toolkits.")
    except Exception as e:
        logger.error(f"Failed to fetch toolkits: {e}")
        return []
    
    all_tools = []
    
    def get_toolkit_tools(tk):
        slug = getattr(tk, 'slug', None)
        if not slug:
            return []
        try:
            tools = client.tools.get(toolkits=[slug])
            if isinstance(tools, list):
                return [(slug, t) for t in tools]
            elif hasattr(tools, 'items'):
                return [(slug, t) for t in tools.items]
            return []
        except Exception:
            return []

    # Using ThreadPool to fetch faster
    logger.info("Fetching tools for each toolkit concurrently (this might take a few minutes)...")
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(get_toolkit_tools, items)
        
    for res in results:
        all_tools.extend(res)
        
    logger.info(f"Total Composio tools fetched: {len(all_tools)}")
    return all_tools

async def fetch_withone_tools():
    """Fetch all tools from WithOne."""
    logger.info("Initializing WithOne client...")
    withone_api_key = os.environ.get("WITHONE_API_KEY", "sk_live_al-EqmgQzu8DjrhYYTRYm7HSqm5qKb4_nxMyuellCZA")
    
    import requests
    headers = {"X-One-Secret": withone_api_key}
    try:
        # Fetching all available integrations for the project
        res = requests.get("https://api.withone.ai/v1/available-connectors?authkit=true&limit=500", headers=headers)
        if res.status_code == 200:
            data = res.json()
            rows = data.get("rows", [])
            logger.info(f"Found {len(rows)} WithOne connectors.")
            
            # Since exact tool extraction requires traversing every tool, we will mock the platform-level tools
            # or store platform-level metadata for now.
            withone_extracted = []
            for conn in rows:
                platform = conn.get("platform")
                desc = conn.get("description", "")
                
                # Mock a single tool entry representing the app connector itself
                withone_extracted.append((platform, {
                    "name": f"WITHONE_CONNECT_{platform.upper().replace('-','_')}",
                    "description": f"Connect and execute actions for {platform}. {desc}",
                    "schema": "{}"
                }))
            return withone_extracted
        else:
            logger.error(f"WithOne API returned {res.status_code}: {res.text}")
            return []
    except Exception as e:
        logger.error(f"WithOne fetch failed: {e}")
        return []

async def main():
    qdrant = init_qdrant()
    embedder = OllamaEmbeddingProvider()
    
    composio_tools = await fetch_composio_tools()
    withone_tools = await fetch_withone_tools()
    
    all_tools = composio_tools + withone_tools
    
    if not all_tools:
        logger.warning("No tools fetched. Exiting.")
        return
        
    logger.info("Preparing data for Qdrant...")
    points = []
    texts_to_embed = []
    metadata_list = []
    
    import uuid
    for app_slug, t in all_tools:
        # Composio tool format handling
        if isinstance(t, dict):
            fn = t.get('function', {})
            name = fn.get('name', 'Unknown')
            desc = fn.get('description', '')
            schema = json.dumps(fn)
        else:
            fn = getattr(t, 'function', None)
            if fn:
                name = getattr(fn, 'name', 'Unknown')
                desc = getattr(fn, 'description', '')
                if hasattr(fn, 'model_dump'):
                    schema = json.dumps(fn.model_dump())
                else:
                    schema = "{}"
            else:
                name = getattr(t, 'name', 'Unknown')
                desc = getattr(t, 'description', '')
                schema = "{}"
                
        if name == 'Unknown' or not desc:
            continue
            
        text_for_embedding = f"{name}: {desc}"
        texts_to_embed.append(text_for_embedding)
        
        metadata_list.append({
            "tool_name": name,
            "app_name": app_slug,
            "provider": "composio",
            "type": "action",
            "schema": schema
        })
        
    logger.info(f"Extracted {len(texts_to_embed)} valid tools. Generating embeddings...")
    
    # Process embeddings in batches so Ollama doesn't choke
    BATCH_SIZE = 32
    embeddings = []
    
    for i in range(0, len(texts_to_embed), BATCH_SIZE):
        batch = texts_to_embed[i:i+BATCH_SIZE]
        logger.info(f"Embedding batch {i//BATCH_SIZE + 1}/{(len(texts_to_embed)+BATCH_SIZE-1)//BATCH_SIZE}...")
        try:
            batch_emb = embedder.embed(batch)
            embeddings.extend(batch_emb)
        except Exception as e:
            logger.error(f"Embedding failed at batch {i}: {e}")
            return
            
    logger.info("Upserting to Qdrant...")
    
    for i in range(len(embeddings)):
        point = models.PointStruct(
            id=str(uuid.uuid4()),
            vector=embeddings[i],
            payload=metadata_list[i]
        )
        points.append(point)
        
    # Upsert in batches of 100
    UPSERT_BATCH = 100
    for i in range(0, len(points), UPSERT_BATCH):
        batch_points = points[i:i+UPSERT_BATCH]
        qdrant.upsert(
            collection_name=COLLECTION_NAME,
            points=batch_points
        )
        
    logger.info(f"Successfully upserted {len(points)} tools to Qdrant!")

if __name__ == "__main__":
    asyncio.run(main())
