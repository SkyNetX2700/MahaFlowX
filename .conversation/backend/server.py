from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import secrets
import re
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class AccessCodeCreate(BaseModel):
    kind: Literal['MFB', 'MFR']
    facility_id: str
    facility_name: str
    expires_in_days: int = 30

class AccessCode(BaseModel):
    id: str
    code: str
    kind: str
    facility_id: str
    facility_name: str
    status: str
    created_at: str
    expires_at: str
    used_at: Optional[str] = None
    used_by: Optional[str] = None

class CodeVerify(BaseModel):
    code: str

class TurnstileVerifyRequest(BaseModel):
    token: str

class CameraCreate(BaseModel):
    name: str
    zone: str
    stream_url: Optional[str] = None
    enabled: bool = True

class Camera(CameraCreate):
    id: str
    status: Literal['LIVE', 'CONNECTING', 'OFFLINE']
    facility_id: str
    updated_at: str

class CrowdReading(BaseModel):
    id: str
    zone: str
    level: Literal['Low', 'Moderate', 'High', 'Very High', 'Critical']
    people_count: int
    facility_id: str
    recorded_at: str

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def code_doc(doc):
    return {k: doc.get(k) for k in AccessCode.model_fields}

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "MahaFlow API", "supabase_configured": True, "data_layer": "Supabase PostgreSQL + RLS"}

@api_router.get('/setup-status')
async def setup_status():
    return {"supabase_configured": bool(os.environ.get('SUPABASE_URL') and os.environ.get('SUPABASE_ANON_KEY')), "turnstile_configured": bool(os.environ.get('TURNSTILE_SECRET_KEY')), "maps_configured": bool(os.environ.get('GOOGLE_MAPS_BROWSER_KEY')), "message": "Supabase, Turnstile and Maps configuration status."}

@api_router.post('/security/turnstile/verify')
async def verify_turnstile(input: TurnstileVerifyRequest):
    secret = os.environ.get('TURNSTILE_SECRET_KEY')
    if not secret:
        raise HTTPException(503, 'Turnstile verification is not configured on the server')
    if not input.token or len(input.token) > 2048:
        raise HTTPException(400, 'Turnstile verification failed')
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            result = await http.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', data={'secret': secret, 'response': input.token})
            result.raise_for_status()
            payload = result.json()
    except httpx.HTTPError:
        raise HTTPException(502, 'Turnstile verification service unavailable')
    if not payload.get('success'):
        raise HTTPException(400, 'Turnstile verification failed')
    return {'verified': True}

@api_router.post('/access-codes', response_model=AccessCode)
async def create_access_code(input: AccessCodeCreate):
    raise HTTPException(410, 'Use authenticated Supabase RPC mahaflow_create_access_code')

@api_router.get('/access-codes', response_model=List[AccessCode])
async def list_access_codes():
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_access_codes table')

@api_router.post('/access-codes/verify', response_model=AccessCode)
async def verify_access_code(input: CodeVerify):
    raise HTTPException(410, 'Use authenticated Supabase RPC mahaflow_get_access_code_details')

@api_router.post('/access-codes/{code}/consume', response_model=AccessCode)
async def consume_access_code(code: str, authority_email: str = Query(...)):
    raise HTTPException(410, 'Use authenticated Supabase RPC mahaflow_complete_authority_onboarding')

@api_router.patch('/access-codes/{code}/disable', response_model=AccessCode)
async def disable_access_code(code: str):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_access_codes table')

@api_router.get('/facilities')
async def facilities():
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_facilities table')

@api_router.get('/cameras', response_model=List[Camera])
async def list_cameras(facility_id: str = 'pune-swargate'):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_cameras table')

@api_router.post('/cameras', response_model=Camera)
async def add_camera(input: CameraCreate, facility_id: str = 'pune-swargate'):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_cameras table')

@api_router.patch('/cameras/{camera_id}', response_model=Camera)
async def update_camera(camera_id: str, input: CameraCreate):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_cameras table')

@api_router.delete('/cameras/{camera_id}')
async def delete_camera(camera_id: str):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_cameras table')

@api_router.get('/crowd-readings', response_model=List[CrowdReading])
async def crowd_readings(facility_id: str = 'pune-swargate'):
    raise HTTPException(410, 'Use the RLS-protected Supabase mahaflow_crowd_readings table')

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()