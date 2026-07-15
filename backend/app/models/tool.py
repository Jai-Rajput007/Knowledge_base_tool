from sqlalchemy import Column, String, Text, JSON
from pgvector.sqlalchemy import Vector
from app.db.database import Base

class ToolEmbedding(Base):
    __tablename__ = "tool_embeddings"

    id = Column(String, primary_key=True)
    provider = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    schema_json = Column(JSON, nullable=False)
    # 768 is the standard dimension for nomic-embed-text/BERT
    embedding = Column(Vector(768))
