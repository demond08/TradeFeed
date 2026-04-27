"""TradeFeedX backend regression tests."""
import os
import io
import base64
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for direct env load
    from dotenv import dotenv_values
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@tradefeedx.com"
DEMO_PASS = "demo1234"
DEMO_USERNAME = "demotrader"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def demo_token(s):
    # ensure demo user exists
    r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    if r.status_code != 200:
        s.post(f"{API}/auth/signup", json={"email": DEMO_EMAIL, "password": DEMO_PASS, "username": DEMO_USERNAME})
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


# --- Auth ---
class TestAuth:
    def test_signup_new_user(self, s):
        suffix = uuid.uuid4().hex[:8]
        r = s.post(f"{API}/auth/signup", json={
            "email": f"test_{suffix}@tfx.com",
            "password": "pass1234",
            "username": f"test_{suffix}"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["email"] == f"test_{suffix}@tfx.com"

    def test_login_demo(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
        assert r.status_code == 200, r.text
        assert "token" in r.json()

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s, demo_headers):
        r = s.get(f"{API}/auth/me", headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_unauth(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self, s):
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# --- Posts / Feed ---
class TestPosts:
    def test_create_post(self, s, demo_headers):
        r = s.post(f"{API}/posts", headers=demo_headers, json={
            "ticker": "aapl", "side": "LONG", "entry": 200, "stop_loss": 195,
            "take_profit": 210, "caption": "TEST_post", "media_url": ""
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ticker"] == "AAPL"
        assert d["side"] == "LONG"
        pytest.post_id = d["post_id"]

    def test_feed_foryou(self, s):
        r = s.get(f"{API}/posts/feed", params={"tab": "foryou"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed_trending(self, s):
        r = s.get(f"{API}/posts/feed", params={"tab": "trending"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed_following_unauth(self, s):
        r = s.get(f"{API}/posts/feed", params={"tab": "following"})
        assert r.status_code == 200
        assert r.json() == []

    def test_feed_following_auth(self, s, demo_headers):
        r = s.get(f"{API}/posts/feed", params={"tab": "following"}, headers=demo_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_like_toggle(self, s, demo_headers):
        pid = pytest.post_id
        r1 = s.post(f"{API}/posts/{pid}/like", headers=demo_headers)
        assert r1.status_code == 200
        first = r1.json()["liked"]
        r2 = s.post(f"{API}/posts/{pid}/like", headers=demo_headers)
        assert r2.status_code == 200
        assert r2.json()["liked"] != first

    def test_outcome_win_updates_user(self, s, demo_headers):
        pid = pytest.post_id
        before = s.get(f"{API}/auth/me", headers=demo_headers).json()
        r = s.post(f"{API}/posts/{pid}/outcome", headers=demo_headers, json={"outcome": "win"})
        assert r.status_code == 200, r.text
        assert r.json()["outcome"] == "win"
        after = s.get(f"{API}/auth/me", headers=demo_headers).json()
        assert after["wins"] == before["wins"] + 1


# --- Search & Profile ---
class TestSearchProfile:
    def test_search_user(self, s):
        r = s.get(f"{API}/search", params={"q": DEMO_USERNAME})
        assert r.status_code == 200
        d = r.json()
        assert any(u["username"] == DEMO_USERNAME for u in d["users"])

    def test_search_ticker(self, s):
        r = s.get(f"{API}/search", params={"q": "AAPL"})
        assert r.status_code == 200
        assert isinstance(r.json()["posts"], list)

    def test_search_empty(self, s):
        r = s.get(f"{API}/search", params={"q": ""})
        assert r.status_code == 200
        assert r.json() == {"users": [], "posts": []}

    def test_get_profile(self, s):
        r = s.get(f"{API}/users/{DEMO_USERNAME}")
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["username"] == DEMO_USERNAME
        assert "win_rate" in d
        assert isinstance(d["posts"], list)

    def test_profile_404(self, s):
        r = s.get(f"{API}/users/nonexistent_user_xyz")
        assert r.status_code == 404


# --- Follow ---
class TestFollow:
    def test_follow_toggle(self, s, demo_headers):
        # create another user to follow
        suffix = uuid.uuid4().hex[:8]
        sr = s.post(f"{API}/auth/signup", json={
            "email": f"tofollow_{suffix}@tfx.com",
            "password": "pass1234",
            "username": f"tofollow_{suffix}"
        })
        assert sr.status_code == 200
        target = sr.json()["user"]["username"]
        r1 = s.post(f"{API}/users/{target}/follow", headers=demo_headers)
        assert r1.status_code == 200 and r1.json()["following"] is True
        r2 = s.post(f"{API}/users/{target}/follow", headers=demo_headers)
        assert r2.status_code == 200 and r2.json()["following"] is False

    def test_follow_self_400(self, s, demo_headers):
        r = s.post(f"{API}/users/{DEMO_USERNAME}/follow", headers=demo_headers)
        assert r.status_code == 400


# --- Settings ---
class TestSettings:
    def test_patch_settings(self, s, demo_headers):
        r = s.patch(f"{API}/me/settings", headers=demo_headers, json={
            "is_private": True, "theme": "light", "bio": "TEST_bio", "name": "Demo Trader"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_private"] is True
        assert d["theme"] == "light"
        assert d["bio"] == "TEST_bio"
        # revert
        s.patch(f"{API}/me/settings", headers=demo_headers, json={"is_private": False, "theme": "dark"})


# --- Upload + media ---
class TestUpload:
    def test_upload_and_fetch(self, s, demo_headers):
        # tiny PNG
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZqQk7YAAAAASUVORK5CYII="
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = s.post(f"{API}/upload", headers=demo_headers, files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["url"].startswith("/api/media/")
        # fetch via media endpoint
        r2 = s.get(f"{BASE_URL}{d['url']}")
        assert r2.status_code == 200
        assert len(r2.content) > 0


# --- News ---
class TestNews:
    def test_news(self, s):
        r = s.get(f"{API}/news")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        if d:
            assert "headline" in d[0]

    def test_news_ticker(self, s):
        r = s.get(f"{API}/news/ticker")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) <= 15


# --- AI analyze trade ---
class TestAI:
    def test_analyze_trade_real_chart(self, s, demo_headers):
        # Fetch a real chart image from Unsplash
        try:
            img_resp = requests.get(
                "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
                timeout=30,
            )
            assert img_resp.status_code == 200
            b64 = base64.b64encode(img_resp.content).decode()
        except Exception:
            pytest.skip("Could not fetch chart image")
        r = s.post(f"{API}/ai/analyze-trade", headers=demo_headers, json={
            "image_base64": b64, "ticker": "AAPL", "notes": "test"
        }, timeout=120)
        assert r.status_code == 200, f"Status: {r.status_code} Body: {r.text[:500]}"
        d = r.json()
        # structured JSON keys (best-effort)
        assert "verdict" in d or "rationale" in d


# --- Insights cleanup ---
class TestInsights:
    def test_cleanup(self, s, demo_headers):
        r = s.post(f"{API}/insights/cleanup", headers=demo_headers, json={
            "rows": [
                {"date": "2025-01-01", "ticker": "AAPL", "pnl": 120},
                {"date": "2025-01-02", "ticker": "TSLA", "pnl": -50},
                {"date": "2025-01-03", "ticker": "AAPL", "pnl": 80},
            ],
            "context": "trader pnl"
        }, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        # at minimum these keys may exist
        assert isinstance(d, dict)
