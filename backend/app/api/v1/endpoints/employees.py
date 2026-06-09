"""Employee management endpoints — admin only except /context."""

import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
import openpyxl

from app.db.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.services.employee_service import EmployeeService
from app.schemas.employee import EmployeeResponse, BulkEnrollResult, ContextResponse

router = APIRouter()

PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ── Employee CRUD ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EmployeeResponse])
def list_employees(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    employees = EmployeeService(db).list_employees()
    return [EmployeeResponse.from_user(e) for e in employees]


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_id: str = Form(...),
    name: str = Form(...),
    email: str = Form(...),
    department: str = Form(None),
    password: str = Form("changeme123"),
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    svc = EmployeeService(db)

    if svc.get_by_employee_id(employee_id):
        raise HTTPException(status_code=400, detail=f"Employee ID '{employee_id}' already exists")

    photo_bytes, filenames = [], []
    for p in photos:
        ext = "." + p.filename.rsplit(".", 1)[-1].lower() if "." in p.filename else ""
        if ext in PHOTO_EXTS:
            photo_bytes.append(await p.read())
            filenames.append(p.filename)

    if not photo_bytes:
        raise HTTPException(status_code=400, detail="At least one valid photo is required (jpg/png)")

    user = svc.create_employee(employee_id, name, email, password, department)

    try:
        svc.enroll_photos(user, photo_bytes, filenames)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return EmployeeResponse.from_user(user)


@router.post("/{employee_id}/photos", response_model=EmployeeResponse)
async def add_photos(
    employee_id: str,
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    svc = EmployeeService(db)
    user = svc.get_by_employee_id(employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    photo_bytes, filenames = [], []
    for p in photos:
        ext = "." + p.filename.rsplit(".", 1)[-1].lower() if "." in p.filename else ""
        if ext in PHOTO_EXTS:
            photo_bytes.append(await p.read())
            filenames.append(p.filename)

    if not photo_bytes:
        raise HTTPException(status_code=400, detail="No valid photos provided")

    try:
        svc.enroll_photos(user, photo_bytes, filenames)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return EmployeeResponse.from_user(user)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    svc = EmployeeService(db)
    user = svc.get_by_employee_id(employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    svc.delete_employee(user.id)


# ── Bulk Excel import ─────────────────────────────────────────────────────────

@router.post("/bulk", response_model=BulkEnrollResult)
async def bulk_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Excel format:
    Columns: employee_id | name | email | department | password (optional)
    Photo: embedded image in column F row (one image per employee row).
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx/.xls files accepted")

    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active

    # Map embedded images to row numbers
    image_by_row: dict[int, bytes] = {}
    for img in ws._images:
        try:
            row = img.anchor._from.row + 1  # openpyxl is 0-indexed
            img_bytes = img.ref.getvalue() if hasattr(img.ref, "getvalue") else img.ref.read()
            image_by_row[row] = img_bytes
        except Exception:
            pass

    svc = EmployeeService(db)
    enrolled, failed, errors = 0, 0, []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:
            continue

        employee_id = str(row[0]).strip()
        name        = str(row[1]).strip() if row[1] else ""
        email       = str(row[2]).strip() if row[2] else ""
        department  = str(row[3]).strip() if row[3] else None
        password    = str(row[4]).strip() if len(row) > 4 and row[4] else "changeme123"

        if not employee_id or not name or not email:
            errors.append({"row": i, "employee_id": employee_id, "reason": "Missing required fields"})
            failed += 1
            continue

        photo_bytes = image_by_row.get(i)
        if not photo_bytes:
            errors.append({"row": i, "employee_id": employee_id, "reason": "Photo is required — no image found in row"})
            failed += 1
            continue

        if svc.get_by_employee_id(employee_id):
            errors.append({"row": i, "employee_id": employee_id, "reason": "Employee ID already exists"})
            failed += 1
            continue

        try:
            user = svc.create_employee(employee_id, name, email, password, department)
            svc.enroll_photos(user, [photo_bytes], [f"{employee_id}.jpg"])
            enrolled += 1
        except Exception as e:
            errors.append({"row": i, "employee_id": employee_id, "reason": str(e)})
            failed += 1

    return BulkEnrollResult(total=enrolled + failed, enrolled=enrolled, failed=failed, errors=errors)


# ── Context endpoint (used by NLP pipeline) ──────────────────────────────────

@router.get("/context/{face_id}", response_model=ContextResponse)
def get_context(face_id: str, db: Session = Depends(get_db)):
    """No auth required — called internally by NLP pipeline on wake word."""
    ctx = EmployeeService(db).get_context(face_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="face_id not found")
    return ctx
