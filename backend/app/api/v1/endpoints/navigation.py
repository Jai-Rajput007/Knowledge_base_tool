import httpx
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.robot_map import RobotMap
from app.core.config import settings
import uuid

router = APIRouter()

ROBOT_SYNC_URL = "http://192.168.1.107:9000"

class TargetPose(BaseModel):
    x: float
    y: float

# ── Proxy Helpers ─────────────────────────────────────────────────────────────

async def _proxy_post(endpoint: str, json_data: dict = None, params: dict = None):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{ROBOT_SYNC_URL}{endpoint}", json=json_data, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Robot Sync error: {str(e)}")

async def _proxy_get(endpoint: str):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{ROBOT_SYNC_URL}{endpoint}")
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Robot Sync error: {str(e)}")

# ── Maps CRUD (Postgres) ──────────────────────────────────────────────────────

class MapCreate(BaseModel):
    name: str
    tenant_id: str

@router.get("/maps")
def list_maps(db: Session = Depends(get_db)):
    maps = db.query(RobotMap).all()
    return {"maps": maps}

@router.post("/maps")
def create_map(map_in: MapCreate, db: Session = Depends(get_db)):
    file_path = f"/home/unitree/maps/{map_in.name}.pcd"
    new_map = RobotMap(
        name=map_in.name,
        tenant_id=map_in.tenant_id,
        file_path=file_path
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    return new_map

@router.delete("/maps/{map_id}")
def delete_map(map_id: str, db: Session = Depends(get_db)):
    db_map = db.query(RobotMap).filter(RobotMap.id == map_id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    db.delete(db_map)
    db.commit()
    return {"success": True}

@router.post("/maps/{map_id}/waypoints")
def add_waypoint(map_id: str, waypoint: dict, db: Session = Depends(get_db)):
    db_map = db.query(RobotMap).filter(RobotMap.id == map_id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    
    waypoints = list(db_map.waypoints) if db_map.waypoints else []
    waypoints.append(waypoint)
    db_map.waypoints = waypoints
    db.commit()
    db.refresh(db_map)
    return db_map

# ── SLAM Navigation Commands ──────────────────────────────────────────────────

@router.post("/slam/map/start")
async def start_mapping():
    return await _proxy_post("/slam/map/start")

@router.post("/slam/map/stop")
async def stop_mapping(map_in: MapCreate, db: Session = Depends(get_db)):
    # 1. Instruct robot_sync to save the map
    address = f"/home/unitree/maps/{map_in.name}.pcd"
    resp = await _proxy_post(f"/slam/map/stop?address={address}")
    
    # 2. Save in DB
    new_map = RobotMap(
        name=map_in.name,
        tenant_id=map_in.tenant_id,
        file_path=address
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    
    return {"status": resp, "map": new_map}

@router.post("/slam/pose/init")
async def init_pose(address: str, x: float = 0.0, y: float = 0.0):
    # Initialize the pose on a specific map
    params = {"address": address, "x": x, "y": y, "z": 0.0, "q_x": 0.0, "q_y": 0.0, "q_z": 0.0, "q_w": 1.0}
    return await _proxy_post(f"/slam/pose/init", json_data=params)

@router.post("/slam/navigate")
async def navigate_to(pose: TargetPose):
    return await _proxy_post("/slam/navigate", json_data=pose.model_dump())

@router.post("/slam/navigate/pause")
async def pause_navigation():
    return await _proxy_post("/slam/navigate/pause")

@router.post("/slam/navigate/resume")
async def resume_navigation():
    return await _proxy_post("/slam/navigate/resume")

@router.post("/slam/close")
async def close_slam():
    return await _proxy_post("/slam/close")

@router.get("/slam/pose/current")
async def get_current_pose():
    return await _proxy_get("/slam/pose/current")

@router.get("/status")
async def check_status():
    try:
        await _proxy_get("/docs") # Just check if reachable
        reachable = True
    except:
        reachable = False
    return {"robot_sync_reachable": reachable}
