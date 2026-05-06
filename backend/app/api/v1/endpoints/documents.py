"""Document API endpoints."""

import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from sqlalchemy.orm import Session
import os
import shutil
from pathlib import Path

from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.activity import Activity, ActivityType
from app.schemas.document import DocumentResponse, DocumentCreate, DocumentStats
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import FileUploadError, NotFoundError
from app.services.ingestion_pipeline import process_document_async, get_progress, register_progress_callback
from app.services.document_loaders.loader_factory import get_supported_extensions, can_load_file

router = APIRouter()


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name"),
    db: Session = Depends(get_db)
):
    """List all documents with optional filtering."""
    query = db.query(Document)
    
    if status:
        query = query.filter(Document.status == status)
    
    if search:
        query = query.filter(Document.name.ilike(f"%{search}%"))
    
    documents = query.order_by(Document.created_at.desc()).all()
    return [doc.to_dict() for doc in documents]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a new document."""
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    supported_exts = get_supported_extensions()
    if file_ext not in supported_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file_ext}. Supported: {', '.join(supported_exts)}"
        )
    
    try:
        # Generate unique filename
        timestamp = int(os.path.getctime(".")) if os.path.exists(".") else 0
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = Path(settings.UPLOAD_DIR) / safe_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Create database record
        doc = Document(
            name=file.filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_type=file_ext.replace(".", ""),
            file_size=file_size,
            status=DocumentStatus.UPLOADED
        )
        
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        logger.info(f"Document uploaded: {file.filename} (ID: {doc.id})")
        
        # Start async processing
        file_content = open(file_path, 'rb').read()
        asyncio.create_task(
            process_document_async(
                document_id=doc.id,
                file_content=file_content,
                filename=file.filename,
                file_type=file_ext.replace('.', '')
            )
        )
        
        return doc.to_dict()
        
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get document by ID."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.to_dict()


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Delete file
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
        
        # Delete from database
        db.delete(doc)
        db.commit()
        
        logger.info(f"Document deleted: {doc.name} (ID: {document_id})")
        
        return {"message": "Document deleted successfully"}
        
    except Exception as e:
        logger.error(f"Delete failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/{document_id}/progress")
async def get_document_progress(document_id: int, db: Session = Depends(get_db)):
    """Get document ingestion progress."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    progress = get_progress(document_id)
    if not progress:
        return {
            "document_id": document_id,
            "stage": doc.status.value,
            "progress_percent": 100 if doc.status == DocumentStatus.INDEXED else 0,
            "message": "No active processing" if doc.status != DocumentStatus.PROCESSING else "Processing started"
        }
    
    return progress.to_dict()


@router.post("/{document_id}/reindex")
async def reindex_document(document_id: int, db: Session = Depends(get_db)):
    """Reindex a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if file exists
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found")
    
    # Update status
    doc.status = DocumentStatus.PROCESSING
    doc.error_message = None
    db.commit()
    
    # Trigger background processing
    file_content = open(doc.file_path, 'rb').read()
    file_type = Path(doc.file_path).suffix.lower().replace('.', '')
    
    asyncio.create_task(
        process_document_async(
            document_id=doc.id,
            file_content=file_content,
            filename=doc.original_filename,
            file_type=file_type
        )
    )
    
    return {"message": "Document queued for reindexing", "document_id": document_id}


@router.get("/{document_id}/content")
async def get_document_content(document_id: int, db: Session = Depends(get_db)):
    """Get extracted document content."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Load and extract content
    try:
        from app.services.document_loaders.loader_factory import load_document
        content = load_document(doc.file_path)
        
        return {
            "document_id": document_id,
            "metadata": content.metadata.__dict__,
            "elements_count": len(content.elements),
            "headings": [h.to_text() for h in content.get_headings()[:20]],
            "tables_count": len(content.get_tables()),
            "images_count": len(content.get_images()),
            "lists_count": len(content.get_lists()),
            "text_preview": content.to_text()[:2000] + "..." if len(content.to_text()) > 2000 else content.to_text()
        }
    except Exception as e:
        logger.error(f"Failed to extract content: {e}")
        raise HTTPException(status_code=500, detail=f"Content extraction failed: {str(e)}")


@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported document formats."""
    return {
        "formats": [
            {"extension": ".pdf", "name": "PDF", "description": "Portable Document Format with text, images, tables"},
            {"extension": ".docx", "name": "Word Document", "description": "Microsoft Word documents with formatting"},
            {"extension": ".txt", "name": "Plain Text", "description": "Plain text files"},
            {"extension": ".md", "name": "Markdown", "description": "Markdown formatted documents"},
            {"extension": ".html", "name": "HTML", "description": "HTML web pages"},
            {"extension": ".csv", "name": "CSV", "description": "Comma-separated values"},
            {"extension": ".json", "name": "JSON", "description": "JSON data files"},
        ]
    }


@router.get("/stats/summary", response_model=DocumentStats)
async def get_document_stats(db: Session = Depends(get_db)):
    """Get document statistics."""
    total = db.query(Document).count()
    indexed = db.query(Document).filter(Document.status == DocumentStatus.INDEXED).count()
    processing = db.query(Document).filter(Document.status == DocumentStatus.PROCESSING).count()
    error = db.query(Document).filter(Document.status == DocumentStatus.ERROR).count()
    
    # Calculate total size
    total_size = sum(doc.file_size for doc in db.query(Document).all())
    
    return {
        "total": total,
        "indexed": indexed,
        "processing": processing,
        "error": error,
        "totalSize": total_size
    }
