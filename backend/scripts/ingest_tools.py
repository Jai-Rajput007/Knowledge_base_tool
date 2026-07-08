import asyncio
import os
import sys
import uuid
import json

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

from app.core.config import settings
from app.services.embedding_service import embedding_service
from app.services.tools.gcp_adapter import GCPAdapter
from app.services.tools.public_adapter import PublicToolsAdapter
from app.core.logging import logger

QDRANT_PATH = "./qdrant_db"
COLLECTION_NAME = "global_tools"

async def ingest():
    logger.info("Initializing adapters...")
    # Mock creds just to load schemas
    gcp = GCPAdapter("mock_token")
    public = PublicToolsAdapter()
    
    all_tools = []
    
    logger.info("Loading GCP tools...")
    gcp_tools = await gcp.get_tools()
    for t in gcp_tools:
        all_tools.append((t, "gcp"))
        
    logger.info("Loading Public tools...")
    public_tools = await public.get_tools()
    for t in public_tools:
        all_tools.append((t, "public"))
        
    logger.info(f"Loaded {len(all_tools)} tools.")
    
    client = QdrantClient(path=QDRANT_PATH)
    
    existing_collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing_collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIMENSIONS,
                distance=Distance.COSINE
            )
        )
        logger.info(f"Created collection {COLLECTION_NAME}")
    else:
        logger.info(f"Collection {COLLECTION_NAME} already exists. We will overwrite points by ID.")
        
    # We will generate a deterministic UUID based on the tool name
    # so we don't duplicate them on re-runs.
    namespace = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
    
    points = []
    
    logger.info("Embedding tools...")
    for idx, (tool, provider) in enumerate(all_tools):
        fn = tool.get("function", {})
        if not fn:
            fn = tool
            
        name = fn.get("name")
        if not name:
            continue
            
        description = fn.get("description", "")
        
        text_to_embed = f"Tool Name: {name}\nDescription: {description}"
        
        # We can embed in batches but for 100 tools it's fast enough one by one or via batched
        # Using embed_documents for batching
        points.append({
            "name": name,
            "provider": provider,
            "description": description,
            "text_to_embed": text_to_embed,
            "schema": json.dumps(tool)
        })
        
    texts = [p["text_to_embed"] for p in points]
    embeddings = embedding_service.embed_documents(texts)
    
    qdrant_points = []
    for p, emb in zip(points, embeddings):
        point_id = str(uuid.uuid5(namespace, p["name"]))
        qdrant_points.append(PointStruct(
            id=point_id,
            vector=emb,
            payload={
                "tool_name": p["name"],
                "provider": p["provider"],
                "description": p["description"]
            }
        ))
        
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=qdrant_points
    )
    
    logger.info(f"Successfully ingested {len(qdrant_points)} tools into Qdrant collection '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    asyncio.run(ingest())
