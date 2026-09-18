from contextlib import asynccontextmanager
import logging
from datetime import datetime, timedelta, timezone
import importlib
from secrets import token_urlsafe

try:
    ObjectId = importlib.import_module("bson").ObjectId
except Exception:
    ObjectId = None
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from .config import get_settings
from .db import Database
from .schemas import (
    AccessRequestIn,
    ActivityOut,
    DecisionIn,
    DirectManagerInviteIn,
    DirectMemberInviteIn,
    EventIn,
    GalleryIn,
    LoginIn,
    ManagerSummaryOut,
    MemberIn,
    PinIn,
    PublicTeamOut,
    ShareInfoOut,
    ShareLinkIn,
    TokenOut,
    UserOut,
)
from .security import (
    create_token,
    current_user,
    event_for_user,
    hash_password,
    require_event_manager,
    require_super_admin,
    to_object_id,
    verify_password,
)
from .storage import upload_image

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


async def log_activity(
    action: str,
    details: str,
    user: dict | None = None,
    event_id: str | None = None,
    event_name: str | None = None,
    manager_id: str | None = None,
):
    """Log an activity record for audit history so users can see everything happening."""
    try:
        db = Database.get()
        doc = {
            "action": action,
            "details": details,
            "user_id": user["id"] if user else None,
            "user_name": user.get("name") if user else None,
            "user_email": user.get("email") if user else None,
            "user_role": user.get("role") if user else "guest",
            "event_id": event_id,
            "event_name": event_name,
            "manager_id": manager_id or (user.get("manager_id") if user else None),
            "created_at": datetime.now(timezone.utc),
        }
        await db.activities.insert_one(doc)
    except Exception:
        pass


async def bootstrap_super_admin():
    """Ensure platform administrator account exists and password stays in sync with .env."""
    settings = get_settings()
    if not settings.super_admin_email or not settings.super_admin_password:
        return
    db = Database.get()
    email = settings.super_admin_email.lower()
    pwd_hash = hash_password(settings.super_admin_password)
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "name": settings.super_admin_name,
            "email": email,
            "password_hash": pwd_hash,
            "role": "super_admin",
            "created_at": datetime.now(timezone.utc),
        })
    else:
        # Keep super admin credentials aligned with .env
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "name": settings.super_admin_name,
                "password_hash": pwd_hash,
                "role": "super_admin",
            }}
        )



@asynccontextmanager
async def lifespan(_: FastAPI):
    Database.connect()
    await bootstrap_super_admin()
    yield
    Database.close()


app = FastAPI(title="Event Gallery API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
allowed_origins = [
    origin.strip()
    for origin in get_settings().frontend_origin.split(",")
    if origin.strip()
]


def public_frontend_url() -> str:
    settings = get_settings()
    return (settings.public_frontend_url or allowed_origins[0]).rstrip("/")


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize(document: dict) -> dict:
    document["id"] = str(document.pop("_id"))
    return document


def request_summary(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "email": document["email"],
        "requested_role": document["requested_role"],
        "team_name": document.get("team_name"),
        "manager_email": document.get("manager_email"),
        "target_manager_id": document.get("target_manager_id"),
        "status": document["status"],
        "created_at": document["created_at"],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/teams/public", response_model=list[PublicTeamOut])
async def list_public_teams():
    """Public discovery of studios/teams so prospective team members can pick from a dropdown."""
    db = Database.get()
    teams = []
    async for m in db.users.find({"role": "event_manager"}).sort("name", 1):
        teams.append({
            "id": str(m["_id"]),
            "manager_name": m["name"],
            "manager_email": m["email"],
            "team_name": m.get("team_name") or f"{m['name']}'s Studio",
        })
    return teams


@app.post("/access-requests", status_code=202)
async def request_access(payload: AccessRequestIn):
    """Create a pending request; no account exists until the correct approver accepts it."""
    db = Database.get()
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account already exists for this email")
    if await db.access_requests.find_one({"email": email, "status": "pending"}):
        raise HTTPException(409, "A request for this email is already pending")

    target_manager_id = None
    manager_email = None
    team_name = None

    if payload.requested_role == "team_member":
        if payload.manager_id:
            try:
                manager = await db.users.find_one({"_id": ObjectId(payload.manager_id), "role": "event_manager"})
            except Exception:
                manager = None
        else:
            manager_email = payload.manager_email.lower() if payload.manager_email else None
            manager = await db.users.find_one({"email": manager_email, "role": "event_manager"})

        if not manager:
            raise HTTPException(404, "That event manager was not found")

        target_manager_id = str(manager["_id"])
        manager_email = manager["email"]
        manager_name = manager.get("name") or "Event Manager"
        team_name = manager.get("team_name") or f"{manager_name}'s Studio"
    elif payload.requested_role == "event_manager":
        team_name = payload.team_name.strip() if payload.team_name else f"{payload.name}'s Studio"

    access_request = {
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "requested_role": payload.requested_role,
        "team_name": team_name,
        "manager_email": manager_email,
        "target_manager_id": target_manager_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    result = await db.access_requests.insert_one(access_request)
    await log_activity(
        action="access_request",
        details=f"{payload.name} ({payload.email}) requested role '{payload.requested_role}'",
        manager_id=target_manager_id,
    )
    return {"id": str(result.inserted_id), "message": "Request submitted for approval"}


@app.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    user = await Database.get().users.find_one({"email": payload.email.lower()})
    if user and verify_password(payload.password, user.get("password_hash", "")):
        return {"access_token": create_token(str(user["_id"]))}
    if not user:
        pending = await Database.get().access_requests.find_one({"email": payload.email.lower(), "status": "pending"})
        if isinstance(pending, dict) and pending.get("status") == "pending":
            raise HTTPException(403, "Your request has been sent! Please wait for a few minutes, the admin will review and accept your profile.")
    raise HTTPException(401, "Incorrect email or password")


@app.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    db = Database.get()
    manager_name = None
    if user["role"] == "team_member" and user.get("manager_id"):
        try:
            mgr = await db.users.find_one({"_id": ObjectId(user["manager_id"])})
            if mgr:
                manager_name = mgr.get("name")
        except Exception:
            pass
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "team_name": user.get("team_name"),
        "manager_id": user.get("manager_id"),
        "manager_name": manager_name,
    }


@app.get("/notifications")
async def notifications(user=Depends(current_user)):
    db = Database.get()
    if user["role"] == "super_admin":
        count = await db.access_requests.count_documents({"requested_role": "event_manager", "status": "pending"})
    elif user["role"] == "event_manager":
        count = await db.access_requests.count_documents({
            "requested_role": "team_member",
            "target_manager_id": user["id"],
            "status": "pending",
        })
    else:
        count = 0
    return {"pending_access_requests": count}


@app.get("/access-requests")
async def list_access_requests(user=Depends(current_user)):
    db = Database.get()
    if user["role"] == "super_admin":
        query = {"requested_role": "event_manager", "status": "pending"}
    elif user["role"] == "event_manager":
        query = {"requested_role": "team_member", "target_manager_id": user["id"], "status": "pending"}
    else:
        raise HTTPException(403, "Only approvers can view access requests")
    return [request_summary(item) async for item in db.access_requests.find(query).sort("created_at", 1)]


async def review_access_request(request_id: str, decision: DecisionIn, reviewer: dict):
    try:
        request_document = await Database.get().access_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request_document = None
    if not request_document:
        raise HTTPException(404, "Access request not found")
    if request_document["status"] != "pending":
        raise HTTPException(409, "This request has already been reviewed")

    is_manager_request = request_document["requested_role"] == "event_manager"
    allowed = (reviewer["role"] == "super_admin" and is_manager_request) or (
        reviewer["role"] == "event_manager"
        and not is_manager_request
        and request_document.get("target_manager_id") == reviewer["id"]
    )
    if not allowed:
        raise HTTPException(403, "You cannot review this access request")

    db = Database.get()
    reviewed_at = datetime.now(timezone.utc)
    updates = {"status": decision.decision, "reviewed_at": reviewed_at, "reviewed_by": reviewer["id"]}
    if decision.decision == "approved":
        if await db.users.find_one({"email": request_document["email"]}):
            raise HTTPException(409, "An account already exists for this email")
        new_user = {
            "name": request_document["name"],
            "email": request_document["email"],
            "password_hash": request_document["password_hash"],
            "role": request_document["requested_role"],
            "created_at": reviewed_at,
        }
        if request_document["requested_role"] == "event_manager":
            new_user["team_name"] = request_document.get("team_name") or f"{request_document['name']}'s Studio"
        elif request_document["requested_role"] == "team_member":
            new_user["manager_id"] = reviewer["id"]
            # associate member with the manager's team name
            reviewer_name = reviewer.get("name") or "Event Manager"
            new_user["team_name"] = reviewer.get("team_name") or f"{reviewer_name}'s Studio"

        inserted = await db.users.insert_one(new_user)
        updates["approved_user_id"] = str(inserted.inserted_id)

    await db.access_requests.update_one({"_id": request_document["_id"]}, {"$set": updates})
    await log_activity(
        action=f"request_{decision.decision}",
        details=(
            f"{reviewer.get('name', reviewer['role'])} {decision.decision} access request "
            f"for {request_document['name']} ({request_document['email']})"
        ),
        user=reviewer,
        manager_id=reviewer["id"],
    )
    return {"message": f"Request {decision.decision}"}


@app.post("/access-requests/{request_id}/review")
async def review_request(request_id: str, payload: DecisionIn, user=Depends(current_user)):
    return await review_access_request(request_id, payload, user)


# ================= SUPER ADMIN MANAGEMENT =================


@app.get("/super/stats")
async def super_stats(user=Depends(require_super_admin)):
    db = Database.get()
    managers = await db.users.count_documents({"role": "event_manager"})
    members = await db.users.count_documents({"role": "team_member"})
    events = await db.events.count_documents({})
    galleries = await db.galleries.count_documents({"is_published": True})
    pending_managers = await db.access_requests.count_documents({"requested_role": "event_manager", "status": "pending"})
    return {
        "managers_count": managers,
        "members_count": members,
        "events_count": events,
        "galleries_count": galleries,
        "pending_managers": pending_managers,
    }


@app.get("/super/managers", response_model=list[ManagerSummaryOut])
async def super_list_managers(user=Depends(require_super_admin)):
    db = Database.get()
    managers = []
    async for m in db.users.find({"role": "event_manager"}).sort("created_at", -1):
        m_id = str(m["_id"])
        members_count = await db.users.count_documents({"role": "team_member", "manager_id": m_id})
        events_count = await db.events.count_documents({"created_by": m_id})
        created_str = m.get("created_at").isoformat() if m.get("created_at") else None
        managers.append({
            "id": m_id,
            "name": m["name"],
            "email": m["email"],
            "team_name": m.get("team_name") or f"{m['name']}'s Studio",
            "members_count": members_count,
            "events_count": events_count,
            "created_at": created_str,
        })
    return managers


@app.post("/super/managers", status_code=201)
async def super_invite_manager(payload: DirectManagerInviteIn, user=Depends(require_super_admin)):
    db = Database.get()
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account already exists for this email")
    doc = {
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "event_manager",
        "team_name": payload.team_name.strip(),
        "created_at": datetime.now(timezone.utc),
        "created_by": user["id"],
    }
    result = await db.users.insert_one(doc)
    await log_activity(
        action="invite_manager",
        details=f"Super Admin invited Event Manager '{payload.name}' ({payload.team_name.strip()})",
        user=user,
    )
    return {"id": str(result.inserted_id), "message": "Event manager created successfully"}


@app.delete("/super/managers/{manager_id}")
async def super_delete_manager(manager_id: str, user=Depends(require_super_admin)):
    db = Database.get()
    try:
        obj_id = ObjectId(manager_id)
    except Exception:
        raise HTTPException(400, "Invalid manager ID")
    result = await db.users.delete_one({"_id": obj_id, "role": "event_manager"})
    if result.deleted_count == 0:
        raise HTTPException(404, "Event manager not found")
    # Clean up associated team members and events
    await db.users.delete_many({"role": "team_member", "manager_id": manager_id})
    await log_activity(
        action="delete_manager",
        details=f"Super Admin removed manager {manager_id}",
        user=user,
    )
    return {"message": "Event manager removed successfully"}


@app.post("/super/reset-users")
async def super_reset_users(user=Depends(require_super_admin)):
    db = Database.get()
    admin_email = (get_settings().super_admin_email or "admin@prismgallery.com").lower()
    res = await db.users.delete_many({"$and": [{"role": {"$ne": "super_admin"}}, {"email": {"$ne": admin_email}}]})
    await db.access_requests.delete_many({})
    await db.events.delete_many({})
    await db.photos.delete_many({})
    await db.galleries.delete_many({})
    return {"message": f"All users except admin removed ({res.deleted_count} deleted)"}


# ================= EVENT MANAGER TEAM MANAGEMENT =================


@app.get("/manager/team")
async def get_manager_team(user=Depends(require_event_manager)):
    db = Database.get()
    members = []
    async for m in db.users.find({"role": "team_member", "manager_id": user["id"]}).sort("created_at", -1):
        m_id = str(m["_id"])
        assigned_events = []
        async for ev in db.events.find({"created_by": user["id"], "team_members": m_id}):
            assigned_events.append({"id": str(ev["_id"]), "name": ev["name"]})
        members.append({
            "id": m_id,
            "name": m["name"],
            "email": m["email"],
            "created_at": m.get("created_at"),
            "assigned_events": assigned_events,
        })
    return members


@app.post("/manager/team/invite", status_code=201)
async def invite_team_member(payload: DirectMemberInviteIn, user=Depends(require_event_manager)):
    db = Database.get()
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account already exists for this email")
    doc = {
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "team_member",
        "manager_id": user["id"],
        "team_name": user.get("team_name") or f"{user['name']}'s Studio",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    await log_activity(
        action="invite_member",
        details=f"{user['name']} added photographer '{payload.name}' ({payload.email}) to studio",
        user=user,
        manager_id=user["id"],
    )
    return {"id": str(result.inserted_id), "message": "Team member added to your studio"}


@app.delete("/manager/team/{member_id}")
async def remove_team_member(member_id: str, user=Depends(require_event_manager)):
    db = Database.get()
    try:
        obj_id = ObjectId(member_id)
    except Exception:
        raise HTTPException(400, "Invalid member ID")
    member = await db.users.find_one({"_id": obj_id, "role": "team_member", "manager_id": user["id"]})
    if not member:
        raise HTTPException(404, "Team member not found in your studio")
    await db.users.delete_one({"_id": obj_id})
    await db.events.update_many({"created_by": user["id"]}, {"$pull": {"team_members": member_id}})
    await log_activity(
        action="remove_member",
        details=f"{user['name']} removed photographer '{member['name']}' from studio",
        user=user,
        manager_id=user["id"],
    )
    return {"message": "Team member removed from your studio"}


# ================= EVENT & PHOTO MANAGEMENT =================


@app.post("/events", status_code=201)
async def create_event(payload: EventIn, user=Depends(require_event_manager)):
    created_at = datetime.now(timezone.utc)
    event = {
        "name": payload.name,
        "created_by": user["id"],
        "team_members": [],
        "created_at": created_at,
    }
    result = await Database.get().events.insert_one(event)
    await log_activity(
        action="create_event",
        details=f"{user['name']} created event '{payload.name}'",
        user=user,
        event_id=str(result.inserted_id),
        event_name=payload.name,
        manager_id=user["id"],
    )
    return {
        "id": str(result.inserted_id),
        "name": payload.name,
        "created_by": user["id"],
        "team_members": [],
        "created_at": created_at,
    }


@app.get("/events")
async def list_events(user=Depends(current_user)):
    if user["role"] == "event_manager":
        query = {"created_by": user["id"]}
    elif user["role"] == "team_member":
        query = {"team_members": user["id"]}
    else:
        query = {}
    return [serialize(item) async for item in Database.get().events.find(query).sort("created_at", -1)]


@app.get("/events/{event_id}")
async def get_event(event_id: str, user=Depends(current_user)):
    return await event_for_user(event_id, user)


@app.get("/events/{event_id}/members")
async def get_event_members(event_id: str, user=Depends(current_user)):
    event = await event_for_user(event_id, user)
    db = Database.get()
    member_ids = []
    for m in event.get("team_members", []):
        try:
            member_ids.append(ObjectId(m))
        except Exception:
            continue
    members = []
    if member_ids:
        async for m in db.users.find({"_id": {"$in": member_ids}}):
            members.append({
                "id": str(m["_id"]),
                "name": m["name"],
                "email": m["email"],
            })
    return members


@app.post("/events/{event_id}/members")
async def add_member(event_id: str, payload: MemberIn, user=Depends(require_event_manager)):
    event = await event_for_user(event_id, user)
    if event["created_by"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only the event owner can add members")
    member = await Database.get().users.find_one({
        "email": payload.email.lower(),
        "role": "team_member",
        "manager_id": user["id"],
    })
    if not member:
        raise HTTPException(404, "Approved member of your team not found")
    await Database.get().events.update_one(
        {"_id": ObjectId(event_id)},
        {"$addToSet": {"team_members": str(member["_id"])}},
    )
    await log_activity(
        action="assign_member",
        details=f"{user['name']} assigned {member['name']} to event '{event['name']}'",
        user=user,
        event_id=event_id,
        event_name=event["name"],
        manager_id=user["id"],
    )
    return {"message": "Team member added to event"}


@app.delete("/events/{event_id}/members/{member_id}")
async def remove_event_member(event_id: str, member_id: str, user=Depends(require_event_manager)):
    event = await event_for_user(event_id, user)
    if event["created_by"] != user["id"] and user["role"] != "super_admin":
        raise HTTPException(403, "Only the event owner can remove members")
    await Database.get().events.update_one(
        {"_id": ObjectId(event_id)},
        {"$pull": {"team_members": member_id}},
    )
    await log_activity(
        action="unassign_member",
        details=f"{user['name']} unassigned a team member from event '{event['name']}'",
        user=user,
        event_id=event_id,
        event_name=event["name"],
        manager_id=user["id"],
    )
    return {"message": "Team member unassigned from event"}


@app.post("/events/{event_id}/photos", status_code=201)
async def upload_photo(event_id: str, file: UploadFile = File(...), user=Depends(current_user)):
    if user["role"] not in {"event_manager", "team_member", "super_admin"}:
        raise HTTPException(403, "Only event teams can upload photos")
    event = await event_for_user(event_id, user)
    event_data = event if isinstance(event, dict) else {}
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image uploads are allowed")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image must be 10MB or smaller")
    try:
        asset = await upload_image(contents, file.filename or "upload")
    except Exception:
        logger.exception("Cloudinary image upload failed")
        raise HTTPException(502, "Image storage is unavailable. Please try again later or contact your administrator.")
    created_at = datetime.now(timezone.utc)
    photo = {
        "event_id": event_id,
        "uploaded_by": user["id"],
        "uploader_name": user.get("name"),
        "filename": file.filename or "upload",
        "storage_url": asset["url"],
        "storage_key": asset["key"],
        "file_size": len(contents),
        "created_at": created_at,
    }
    result = await Database.get().photos.insert_one(photo)
    await log_activity(
        action="upload_photo",
        details=(
            f"{user.get('name', user['id'])} uploaded photo '{file.filename or 'upload'}' "
            f"to event '{event_data.get('name', event_id)}'"
        ),
        user=user,
        event_id=event_id,
        event_name=event_data.get("name"),
        manager_id=event_data.get("created_by"),
    )
    return {
        "id": str(result.inserted_id),
        "event_id": event_id,
        "uploaded_by": user["id"],
        "uploader_name": user.get("name"),
        "filename": file.filename or "upload",
        "storage_url": asset["url"],
        "storage_key": asset["key"],
        "file_size": len(contents),
        "created_at": created_at,
    }


@app.get("/events/{event_id}/photos")
async def list_photos(event_id: str, mine: bool = False, user=Depends(current_user)):
    await event_for_user(event_id, user)
    query = {"event_id": event_id}
    if mine:
        query["uploaded_by"] = user["id"]
    return [serialize(item) async for item in Database.get().photos.find(query).sort("created_at", -1)]


# ================= GALLERY CREATION & 4-DIGIT PIN SHARE ACCESS =================


@app.get("/events/{event_id}/gallery", response_model=ShareInfoOut | None)
async def get_event_gallery(event_id: str, user=Depends(current_user)):
    """Fetch active share link and 4-digit PIN for authorized event participants."""
    event = await event_for_user(event_id, user)
    db = Database.get()
    gallery = await db.galleries.find_one({"event_id": event_id})
    if not gallery:
        return None
    photo_count = len(gallery.get("photo_ids", []))
    if photo_count == 0:
        photo_count = await db.photos.count_documents({"event_id": event_id})
    frontend_origin = public_frontend_url()
    created_str = (
        gallery["published_at"].isoformat()
        if gallery.get("published_at")
        else (gallery["created_at"].isoformat() if gallery.get("created_at") else None)
    )
    return {
        "id": str(gallery["_id"]),
        "event_id": event_id,
        "slug": gallery["slug"],
        "share_url": f"{frontend_origin}/gallery/{gallery['slug']}",
        "pin": gallery.get("plain_pin"),
        "is_published": gallery.get("is_published", False),
        "photo_count": photo_count,
        "created_at": created_str,
    }


@app.post("/events/{event_id}/share-link", response_model=ShareInfoOut)
@app.post("/events/{event_id}/gallery", status_code=201)
async def create_or_update_share_link(
    event_id: str,
    payload: ShareLinkIn | GalleryIn,
    user=Depends(current_user),
):
    """Generate or update the access PIN shareable link for an event.
    Accessible to the event manager, assigned team members, and platform administrators."""
    if user["role"] not in {"event_manager", "team_member", "super_admin"}:
        raise HTTPException(403, "Only event participants can manage share links")
    event = await event_for_user(event_id, user)
    db = Database.get()

    photo_ids = getattr(payload, "photo_ids", None) or []
    if photo_ids:
        try:
            ids = [ObjectId(p) for p in photo_ids]
        except Exception:
            raise HTTPException(400, "Invalid photo ID")
        count = await db.photos.count_documents({"_id": {"$in": ids}, "event_id": event_id})
        if count != len(ids):
            raise HTTPException(400, "Every selected photo must belong to this event")

    now = datetime.now(timezone.utc)
    existing = await db.galleries.find_one({"event_id": event_id})

    if existing:
        slug = existing["slug"]
        gallery_id = existing["_id"]
        updates = {
            "pin_hash": hash_password(payload.pin),
            "plain_pin": payload.pin,
            "photo_ids": photo_ids,
            "is_published": True,
            "published_at": now,
            "pin_failed_attempts": 0,
            "pin_locked_until": None,
        }
        await db.galleries.update_one({"_id": gallery_id}, {"$set": updates})
    else:
        slug = token_urlsafe(8).lower()
        doc = {
            "event_id": event_id,
            "photo_ids": photo_ids,
            "slug": slug,
            "pin_hash": hash_password(payload.pin),
            "plain_pin": payload.pin,
            "is_published": True,
            "published_at": now,
            "created_at": now,
            "created_by": user["id"],
            "pin_failed_attempts": 0,
            "pin_locked_until": None,
        }
        res = await db.galleries.insert_one(doc)
        gallery_id = res.inserted_id

    await log_activity(
        action="generate_share_link",
        details=f"{user['name']} set 4-digit PIN share link for event '{event['name']}'",
        user=user,
        event_id=event_id,
        event_name=event["name"],
        manager_id=event.get("created_by"),
    )

    photo_count = len(photo_ids) if photo_ids else await db.photos.count_documents({"event_id": event_id})
    frontend_origin = public_frontend_url()

    return {
        "id": str(gallery_id),
        "event_id": event_id,
        "slug": slug,
        "share_url": f"{frontend_origin}/gallery/{slug}",
        "pin": payload.pin,
        "is_published": True,
        "photo_count": photo_count,
        "created_at": now.isoformat(),
    }


@app.patch("/galleries/{gallery_id}/publish")
async def publish_gallery(gallery_id: str, user=Depends(current_user)):
    if user["role"] not in {"event_manager", "super_admin"}:
        raise HTTPException(403, "Only event managers can publish galleries")
    try:
        gallery = await Database.get().galleries.find_one({"_id": ObjectId(gallery_id)})
    except Exception:
        gallery = None
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    event = await event_for_user(gallery["event_id"], user)
    if user["role"] != "super_admin" and str(event.get("created_by")) != str(user.get("id")):
        raise HTTPException(403, "Only the event lead/manager can publish this gallery")
    published_at = datetime.now(timezone.utc)
    await Database.get().galleries.update_one(
        {"_id": gallery["_id"]},
        {"$set": {"is_published": True, "published_at": published_at}},
    )
    await log_activity(
        action="publish_gallery",
        details=f"{user['name']} published gallery for event '{event['name']}'",
        user=user,
        event_id=gallery.get("event_id"),
        event_name=event["name"],
        manager_id=event.get("created_by"),
    )
    return {"message": "Gallery published", "slug": gallery["slug"]}


@app.post("/gallery/{slug}/access")
@limiter.limit("30/minute")
async def access_gallery(request: Request, slug: str, payload: PinIn):
    db = Database.get()
    gallery = await db.galleries.find_one({"slug": slug, "is_published": True})
    if not gallery:
        raise HTTPException(404, "Gallery not found")

    now = datetime.now(timezone.utc)
    locked_until = gallery.get("pin_locked_until")
    if locked_until and locked_until > now:
        raise HTTPException(429, "Gallery PIN is temporarily locked; try again later")
    if not verify_password(payload.pin, gallery["pin_hash"]):
        failures = gallery.get("pin_failed_attempts", 0) + 1
        updates = {"pin_failed_attempts": failures}
        if failures >= 5:
            updates["pin_locked_until"] = now + timedelta(minutes=15)
        await db.galleries.update_one({"_id": gallery["_id"]}, {"$set": updates})
        raise HTTPException(401, "Incorrect PIN")

    await db.galleries.update_one({"_id": gallery["_id"]}, {"$set": {"pin_failed_attempts": 0, "pin_locked_until": None}})
    
    # If gallery has specific photo_ids, use those; otherwise return all photos uploaded to the event
    if gallery.get("photo_ids") and len(gallery["photo_ids"]) > 0:
        valid_oids = [to_object_id(photo_id) for photo_id in gallery["photo_ids"] if to_object_id(photo_id)]
        query = {"_id": {"$in": valid_oids}}
    else:
        query = {"event_id": gallery["event_id"]}

    cursor = db.photos.find(query)
    # Motor cursors support database-side sorting; accepting a plain async
    # iterable here also keeps the endpoint compatible with lightweight stores.
    if hasattr(cursor, "sort"):
        cursor = cursor.sort("created_at", -1)
    photos = [serialize(item) async for item in cursor]
    
    # Fetch event info to display on the public gallery
    event_info = None
    try:
        ev = await db.events.find_one({"_id": ObjectId(gallery["event_id"])})
        if ev:
            event_info = {"name": ev["name"]}
    except Exception:
        pass

    await log_activity(
        action="guest_access",
        details=f"Guest accessed gallery with 4-digit PIN",
        event_id=gallery.get("event_id"),
        event_name=event_info.get("name") if event_info else None,
    )

    return {"slug": slug, "photos": photos, "event": event_info}


# ================= ACTIVITY AUDIT HISTORY =================


@app.get("/activities", response_model=list[ActivityOut])
async def list_activities(event_id: str | None = None, limit: int = 50, user=Depends(current_user)):
    db = Database.get()
    query = {}
    if event_id:
        await event_for_user(event_id, user)
        query["event_id"] = event_id
    elif user["role"] == "super_admin":
        query = {}
    elif user["role"] == "event_manager":
        query = {"$or": [{"manager_id": user["id"]}, {"user_id": user["id"]}]}
    elif user["role"] == "team_member":
        assigned_events = [str(ev["_id"]) async for ev in db.events.find({"team_members": user["id"]})]
        query = {"$or": [{"user_id": user["id"]}, {"event_id": {"$in": assigned_events}}]}

    activities = []
    async for item in db.activities.find(query).sort("created_at", -1).limit(limit):
        created_str = item["created_at"].isoformat() if item.get("created_at") else None
        activities.append({
            "id": str(item["_id"]),
            "user_id": item.get("user_id"),
            "user_name": item.get("user_name"),
            "user_email": item.get("user_email"),
            "user_role": item.get("user_role"),
            "action": item.get("action", ""),
            "details": item.get("details", ""),
            "event_id": item.get("event_id"),
            "event_name": item.get("event_name"),
            "created_at": created_str,
        })
    return activities