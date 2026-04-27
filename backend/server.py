"""TradeFeedX backend - TikTok-style social app for traders."""
import os
import uuid
import logging
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Query, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
import bcrypt
import jwt as pyjwt
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev")
APP_NAME = os.environ.get("APP_NAME", "tradefeedx")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TradeFeedX")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tradefeedx")

# ------------------------------------------------------------------
# Object Storage (Emergent)
# ------------------------------------------------------------------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: Optional[str] = None


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
class SignupReq(BaseModel):
    email: EmailStr
    password: str
    username: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    user_id: str
    email: str
    username: str
    name: Optional[str] = ""
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""
    is_private: bool = False
    theme: str = "dark"
    followers_count: int = 0
    following_count: int = 0
    wins: int = 0
    losses: int = 0
    created_at: str


class PostCreate(BaseModel):
    ticker: str
    side: str = "LONG"  # LONG | SHORT
    entry: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    caption: Optional[str] = ""
    media_url: Optional[str] = ""
    media_type: Optional[str] = "image"  # image | video


class Post(BaseModel):
    post_id: str
    author_id: str
    ticker: str
    side: str
    entry: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    caption: str = ""
    media_url: str = ""
    media_type: str = "image"
    outcome: str = "pending"  # pending | win | loss
    likes: int = 0
    created_at: str


class OutcomeReq(BaseModel):
    outcome: str  # win | loss | pending


class SettingsUpdate(BaseModel):
    is_private: Optional[bool] = None
    theme: Optional[str] = None
    bio: Optional[str] = None
    name: Optional[str] = None


class AnalyzeReq(BaseModel):
    image_base64: str  # raw base64, no data URI
    ticker: Optional[str] = ""
    notes: Optional[str] = ""


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_user_from_token(token: str) -> Optional[dict]:
    if not token:
        return None
    # Try JWT
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        uid = payload.get("user_id")
        if uid:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0})
            if u:
                return u
    except Exception:
        pass
    # Try Emergent session token
    sess = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < datetime.now(timezone.utc):
            return None
        return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    return None


async def current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = None,
    request: Request = None,
) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token and request is not None:
        token = request.cookies.get("session_token")
    user = await get_user_from_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def optional_user(request: Request) -> Optional[dict]:
    auth = request.headers.get("authorization") or ""
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        return None
    return await get_user_from_token(token)


def user_public(u: dict) -> dict:
    if not u:
        return {}
    return {
        "user_id": u.get("user_id"),
        "email": u.get("email"),
        "username": u.get("username"),
        "name": u.get("name", ""),
        "bio": u.get("bio", ""),
        "avatar_url": u.get("avatar_url", ""),
        "is_private": u.get("is_private", False),
        "theme": u.get("theme", "dark"),
        "followers_count": u.get("followers_count", 0),
        "following_count": u.get("following_count", 0),
        "wins": u.get("wins", 0),
        "losses": u.get("losses", 0),
        "created_at": u.get("created_at", ""),
    }


async def decorate_post(
    p: dict,
    viewer: Optional[dict],
    author_map: Optional[dict] = None,
    liked_set: Optional[set] = None,
) -> dict:
    if author_map is not None:
        author = author_map.get(p["author_id"])
    else:
        author = await db.users.find_one({"user_id": p["author_id"]}, {"_id": 0})
    if liked_set is not None:
        liked = p["post_id"] in liked_set
    else:
        liked = False
        if viewer:
            lk = await db.likes.find_one({"user_id": viewer["user_id"], "post_id": p["post_id"]})
            liked = bool(lk)
    return {
        "post_id": p["post_id"],
        "author": user_public(author) if author else {},
        "ticker": p["ticker"],
        "side": p.get("side", "LONG"),
        "entry": p.get("entry"),
        "stop_loss": p.get("stop_loss"),
        "take_profit": p.get("take_profit"),
        "caption": p.get("caption", ""),
        "media_url": p.get("media_url", ""),
        "media_type": p.get("media_type", "image"),
        "outcome": p.get("outcome", "pending"),
        "likes": p.get("likes", 0),
        "liked_by_me": liked,
        "created_at": p.get("created_at"),
    }


async def batch_decorate(posts: list, viewer: Optional[dict]) -> list:
    if not posts:
        return []
    author_ids = list({p["author_id"] for p in posts})
    authors = await db.users.find({"user_id": {"$in": author_ids}}, {"_id": 0}).to_list(len(author_ids))
    author_map = {a["user_id"]: a for a in authors}
    liked_set: set = set()
    if viewer:
        post_ids = [p["post_id"] for p in posts]
        likes = await db.likes.find(
            {"user_id": viewer["user_id"], "post_id": {"$in": post_ids}}
        ).to_list(len(post_ids))
        liked_set = {lk["post_id"] for lk in likes}
    out = []
    for p in posts:
        out.append(await decorate_post(p, viewer, author_map=author_map, liked_set=liked_set))
    return out


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
@api.post("/auth/signup")
async def signup(data: SignupReq):
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already taken")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": data.email.lower(),
        "username": data.username.lower(),
        "name": data.username,
        "bio": "",
        "avatar_url": "",
        "is_private": False,
        "theme": "dark",
        "followers_count": 0,
        "following_count": 0,
        "wins": 0,
        "losses": 0,
        "password_hash": hash_pw(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = make_token(user_id)
    return {"token": token, "user": user_public(doc)}


@api.post("/auth/login")
async def login(data: LoginReq):
    u = await db.users.find_one({"email": data.email.lower()})
    if not u or not check_pw(data.password, u.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(u["user_id"])
    return {"token": token, "user": user_public(u)}


@api.post("/auth/google/session")
async def google_session(payload: dict, response: Response):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id},
        timeout=20,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    d = r.json()
    email = d.get("email", "").lower()
    name = d.get("name", "")
    picture = d.get("picture", "")
    session_token = d.get("session_token")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "avatar_url": picture}})
        u_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        base_username = (email.split("@")[0] or f"trader{uuid.uuid4().hex[:4]}").lower()
        # ensure unique username
        username = base_username
        i = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{i}"
            i += 1
        u_doc = {
            "user_id": user_id,
            "email": email,
            "username": username,
            "name": name,
            "bio": "",
            "avatar_url": picture,
            "is_private": False,
            "theme": "dark",
            "followers_count": 0,
            "following_count": 0,
            "wins": 0,
            "losses": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(u_doc)

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": u_doc["user_id"],
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
    return {"user": user_public(u_doc), "token": session_token}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user_public(user)


@api.post("/auth/logout")
async def logout(response: Response, request: Request):
    token = request.cookies.get("session_token")
    if token:
        await db.sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ------------------------------------------------------------------
# Upload
# ------------------------------------------------------------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    key_path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    ctype = file.content_type or "application/octet-stream"
    result = put_object(key_path, data, ctype)
    await db.files.insert_one(
        {
            "id": str(uuid.uuid4()),
            "storage_path": result["path"],
            "owner_id": user["user_id"],
            "content_type": ctype,
            "size": result.get("size", len(data)),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"path": result["path"], "url": f"/api/media/{result['path']}", "content_type": ctype}


@api.get("/media/{path:path}")
async def media(path: str):
    try:
        data, ctype = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=data, media_type=ctype)


# ------------------------------------------------------------------
# Posts / Feed
# ------------------------------------------------------------------
@api.post("/posts")
async def create_post(data: PostCreate, user: dict = Depends(current_user)):
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    doc = {
        "post_id": post_id,
        "author_id": user["user_id"],
        "ticker": data.ticker.upper(),
        "side": data.side.upper(),
        "entry": data.entry,
        "stop_loss": data.stop_loss,
        "take_profit": data.take_profit,
        "caption": data.caption or "",
        "media_url": data.media_url or "",
        "media_type": data.media_type or "image",
        "outcome": "pending",
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.insert_one(doc)
    return await decorate_post(doc, user)


@api.get("/posts/feed")
async def feed(
    tab: str = Query("foryou"),
    request: Request = None,
):
    viewer = await optional_user(request)
    q = {}
    if tab == "following":
        if not viewer:
            return []
        following = await db.follows.find({"follower_id": viewer["user_id"]}).to_list(10000)
        ids = [f["following_id"] for f in following]
        q = {"author_id": {"$in": ids}}
    cursor = db.posts.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    posts = await cursor.to_list(100)
    if tab == "trending":
        posts.sort(key=lambda p: (p.get("likes", 0), p.get("created_at", "")), reverse=True)
    return await batch_decorate(posts, viewer)


@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(current_user)):
    existing = await db.likes.find_one({"user_id": user["user_id"], "post_id": post_id})
    if existing:
        await db.likes.delete_one({"user_id": user["user_id"], "post_id": post_id})
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes": -1}})
        return {"liked": False}
    await db.likes.insert_one(
        {"user_id": user["user_id"], "post_id": post_id, "created_at": datetime.now(timezone.utc).isoformat()}
    )
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes": 1}})
    return {"liked": True}


@api.post("/posts/{post_id}/outcome")
async def set_outcome(post_id: str, data: OutcomeReq, user: dict = Depends(current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    prev = post.get("outcome", "pending")
    new = data.outcome.lower()
    if new not in ("win", "loss", "pending"):
        raise HTTPException(status_code=400, detail="Bad outcome")

    delta_win = 0
    delta_loss = 0
    if prev == "win":
        delta_win -= 1
    if prev == "loss":
        delta_loss -= 1
    if new == "win":
        delta_win += 1
    if new == "loss":
        delta_loss += 1

    await db.posts.update_one({"post_id": post_id}, {"$set": {"outcome": new}})
    if delta_win or delta_loss:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"wins": delta_win, "losses": delta_loss}},
        )
    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await decorate_post(updated, user)


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(current_user)):
    post = await db.posts.find_one({"post_id": post_id})
    if not post or post["author_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Not found")
    await db.posts.delete_one({"post_id": post_id})
    await db.likes.delete_many({"post_id": post_id})
    return {"ok": True}


# ------------------------------------------------------------------
# Users: search, profile, follow
# ------------------------------------------------------------------
@api.get("/search")
async def search(q: str = Query("")):
    q = (q or "").strip()
    if not q:
        return {"users": [], "posts": []}
    ql = q.lower()
    users = await db.users.find(
        {"$or": [{"username": {"$regex": ql, "$options": "i"}}, {"name": {"$regex": ql, "$options": "i"}}]},
        {"_id": 0},
    ).limit(20).to_list(20)
    posts = await db.posts.find({"ticker": {"$regex": q.upper(), "$options": "i"}}, {"_id": 0}).limit(20).to_list(20)
    decorated = await batch_decorate(posts, None)
    return {"users": [user_public(u) for u in users], "posts": decorated}


@api.get("/search/suggestions")
async def search_suggestions(request: Request):
    """Return trending tickers + top traders for empty search state."""
    # Aggregate top tickers
    pipeline = [
        {"$group": {"_id": "$ticker", "count": {"$sum": 1}, "likes": {"$sum": "$likes"}}},
        {"$sort": {"likes": -1, "count": -1}},
        {"$limit": 8},
    ]
    tick_rows = await db.posts.aggregate(pipeline).to_list(8)
    tickers = [{"ticker": r["_id"], "posts": r["count"]} for r in tick_rows if r["_id"]]
    if len(tickers) < 4:
        defaults = ["AAPL", "TSLA", "NVDA", "SPY", "BTC", "ETH", "AMD", "MSFT"]
        existing = {t["ticker"] for t in tickers}
        for d in defaults:
            if d not in existing:
                tickers.append({"ticker": d, "posts": 0})
            if len(tickers) >= 8:
                break
    # Top traders by followers
    top_traders = await db.users.find({}, {"_id": 0}).sort("followers_count", -1).limit(6).to_list(6)
    return {
        "tickers": tickers[:8],
        "traders": [user_public(u) for u in top_traders],
    }


@api.get("/users/{username}")
async def get_profile(username: str, request: Request):
    viewer = await optional_user(request)
    u = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    posts = await db.posts.find({"author_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    decorated = await batch_decorate(posts, viewer)
    total = u.get("wins", 0) + u.get("losses", 0)
    win_rate = round((u.get("wins", 0) / total) * 100, 1) if total > 0 else 0.0
    is_following = False
    if viewer:
        is_following = bool(
            await db.follows.find_one({"follower_id": viewer["user_id"], "following_id": u["user_id"]})
        )
    return {
        "user": user_public(u),
        "posts": decorated,
        "win_rate": win_rate,
        "trade_count": total,
        "is_following": is_following,
        "is_me": bool(viewer and viewer["user_id"] == u["user_id"]),
    }


@api.post("/users/{username}/follow")
async def follow_user(username: str, user: dict = Depends(current_user)):
    target = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot follow self")
    existing = await db.follows.find_one({"follower_id": user["user_id"], "following_id": target["user_id"]})
    if existing:
        await db.follows.delete_one({"follower_id": user["user_id"], "following_id": target["user_id"]})
        await db.users.update_one({"user_id": target["user_id"]}, {"$inc": {"followers_count": -1}})
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"following_count": -1}})
        return {"following": False}
    await db.follows.insert_one(
        {
            "follower_id": user["user_id"],
            "following_id": target["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    await db.users.update_one({"user_id": target["user_id"]}, {"$inc": {"followers_count": 1}})
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"following_count": 1}})
    return {"following": True}


@api.patch("/me/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(u)


@api.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "jpg"
    key_path = f"{APP_NAME}/avatars/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    ctype = file.content_type or "image/jpeg"
    result = put_object(key_path, data, ctype)
    url = f"/api/media/{result['path']}"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"avatar_url": url}})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(u)


# ------------------------------------------------------------------
# News (Finnhub)
# ------------------------------------------------------------------
@api.get("/news")
async def news(category: str = "general"):
    if not FINNHUB_API_KEY:
        return []
    try:
        r = requests.get(
            "https://finnhub.io/api/v1/news",
            params={"category": category, "token": FINNHUB_API_KEY},
            timeout=15,
        )
        if r.status_code != 200:
            return []
        items = r.json()[:50]
        return [
            {
                "id": str(i.get("id")),
                "headline": i.get("headline"),
                "summary": i.get("summary"),
                "source": i.get("source"),
                "url": i.get("url"),
                "image": i.get("image"),
                "datetime": i.get("datetime"),
                "related": i.get("related"),
            }
            for i in items
        ]
    except Exception as e:
        logger.error(f"news error: {e}")
        return []


@api.get("/news/ticker")
async def news_ticker():
    items = await news()
    return [{"headline": i["headline"], "source": i.get("source", "")} for i in items[:15]]


# ------------------------------------------------------------------
# AI Trade Analysis (Gemini 3 Pro vision)
# ------------------------------------------------------------------
@api.post("/ai/analyze-trade")
async def analyze_trade(data: AnalyzeReq, user: dict = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="LLM key not configured")
    # Clean the base64 (strip data URI prefix if present)
    b64 = data.image_base64
    if "," in b64 and b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]

    system = (
        "You are a senior institutional technical analyst and risk manager. You analyze a trading chart screenshot "
        "and produce a rigorous, multi-factor trade plan. Respond with STRICT JSON ONLY (no markdown, no prose outside JSON). "
        "Required keys:\n"
        "  verdict: 'GOOD' | 'RISKY' | 'BAD'\n"
        "  confidence: int 0-100\n"
        "  side: 'LONG' | 'SHORT'\n"
        "  timeframe: short string (e.g. '5m','15m','1h','4h','1D') inferred from the chart\n"
        "  trend: 'UPTREND' | 'DOWNTREND' | 'RANGE' | 'CHOPPY'\n"
        "  pattern: short string of the dominant pattern (e.g. 'bull flag','double top','range break','head & shoulders')\n"
        "  key_levels: { support: [numbers], resistance: [numbers] }  (1-3 values each, estimated from chart)\n"
        "  entry: number or null (suggested entry price)\n"
        "  stop_loss: number or null\n"
        "  take_profit: number or null\n"
        "  targets: [numbers] (optional additional TP levels, 0-3)\n"
        "  risk_reward: number (TP-entry)/(entry-SL) rounded to 2 decimals, or null if unknown\n"
        "  indicators: short string of any indicators visible (e.g. 'EMA20/50, RSI bullish div, volume spike')\n"
        "  entry_reasoning: <= 35 words why this setup works\n"
        "  risks: <= 35 words listing top 2 risk factors / invalidation\n"
        "  alt_scenario: <= 25 words describing what happens if the setup fails\n"
        "  rationale: <= 40 words concise overall summary\n"
        "If a field cannot be reasonably inferred, use null (or empty list). Use the same numeric scale as visible on the chart."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ai-trade-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("gemini", "gemini-3.1-pro-preview")

    user_text = (
        f"Ticker: {data.ticker or 'UNKNOWN'}. "
        f"User notes: {data.notes or 'none'}. "
        "Analyze the chart in depth: identify timeframe, trend, dominant pattern, key support/resistance, "
        "indicators present, and produce a complete trade plan (entry, SL, TP, optional targets, R:R, "
        "reasoning, risks, and alternative scenario). Return the strict JSON schema specified."
    )
    msg = UserMessage(text=user_text, file_contents=[ImageContent(image_base64=b64)])
    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        logger.exception("Gemini call failed")
        raise HTTPException(status_code=502, detail=f"AI error: {e}")

    # Best effort JSON parse
    import json, re
    text = resp.strip() if isinstance(resp, str) else str(resp)
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(text)
    except Exception:
        logger.warning(f"AI analyze non-JSON reply: {text[:500]}")
        parsed = {
            "verdict": "RISKY", "confidence": 50, "side": "LONG",
            "timeframe": None, "trend": None, "pattern": None,
            "key_levels": {"support": [], "resistance": []},
            "entry": None, "stop_loss": None, "take_profit": None,
            "targets": [], "risk_reward": None, "indicators": None,
            "entry_reasoning": text[:200], "risks": "", "alt_scenario": "",
            "rationale": text[:200],
        }
    return parsed


# ------------------------------------------------------------------
# Data-cleanup utility (from original problem statement)
# ------------------------------------------------------------------
class CleanupReq(BaseModel):
    rows: List[dict]
    context: Optional[str] = ""


@api.post("/insights/cleanup")
async def cleanup_insights(data: CleanupReq, user: dict = Depends(current_user)):
    """Accept raw rows (JSON/CSV-ish) and return cleaned data + next-step insights."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="LLM key not configured")
    if not data.rows:
        raise HTTPException(status_code=400, detail="No rows")
    system = (
        "You are a business data analyst. Given raw rows, return JSON with: "
        "cleaned_summary (string), issues (list of strings), "
        "top_insights (list of 3 strings), next_steps (list of 3 actionable strings)."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"cleanup-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("gemini", "gemini-3.1-pro-preview")
    import json
    payload = json.dumps({"rows": data.rows[:200], "context": data.context})
    try:
        resp = await chat.send_message(UserMessage(text=payload))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    text = resp.strip() if isinstance(resp, str) else str(resp)
    import re
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        return {"cleaned_summary": text[:500], "issues": [], "top_insights": [], "next_steps": []}


@api.get("/")
async def root():
    return {"ok": True, "app": "tradefeedx"}


# ------------------------------------------------------------------
# App wiring
# ------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Emergent storage initialized")
    except Exception as e:
        logger.error(f"storage init failed: {e}")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.posts.create_index([("created_at", -1)])
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.likes.create_index([("user_id", 1), ("post_id", 1)], unique=True)


@app.on_event("shutdown")
async def shutdown():
    client.close()
