import asyncio
import os
import sys
import uuid
import json

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.tool import ToolEmbedding
from app.services.embedding_service import embedding_service
from app.services.tools.gcp_adapter import GCPAdapter
from app.services.tools.public_adapter import PublicToolsAdapter
from app.core.logging import logger

async def ingest():
    logger.info("Initializing adapters...")
    gcp = GCPAdapter("mock_token")
    public = PublicToolsAdapter()
    
    all_tools = []
    
    logger.info("Loading GCP tools...")
    gcp_tools = await gcp.get_tools()
    for t in gcp_tools:
        all_tools.append((t, "taylorwilsdon/google_workspace_mcp"))
        
    logger.info("Loading Public tools...")
    public_tools = await public.get_tools()
    for t in public_tools:
        all_tools.append((t, "public"))
        
    logger.info(f"Loaded {len(all_tools)} tools.")
    
    with SessionLocal() as db:
        # Clear existing to prevent stale tools (or we could UPSERT)
        db.query(ToolEmbedding).delete()
        db.commit()

        for tool_schema, provider in all_tools:
            # Extract name and description safely
            fn = tool_schema.get("function", {})
            name = fn.get("name")
            desc = fn.get("description", "")
            
            if not name:
                name = tool_schema.get("name")
                desc = tool_schema.get("description", "")
                
            if not name or not desc:
                continue
                
            text_to_embed = f"{name}: {desc}"
            # Create embedding
            embedding = embedding_service.embed_query(text_to_embed)
            
            tool_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{provider}_{name}"))
            
            te = ToolEmbedding(
                id=tool_id,
                provider=provider,
                name=name,
                description=desc,
                schema_json=tool_schema,
                embedding=embedding
            )
            db.add(te)
            
        db.commit()
        logger.info(f"Successfully ingested {len(all_tools)} tools into PostgreSQL.")

if __name__ == "__main__":
    asyncio.run(ingest())
