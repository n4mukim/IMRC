#!/usr/bin/env python3
"""Copy the PUBLISHED blog posts from Supabase into tools/blog_posts.json, ready for build.py.

Uses only the public anon key: row-level security already limits it to published posts and public author cards.
  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... python3 tools/fetch_posts.py
If anything fails (network, key, server error) the existing blog_posts.json is left untouched and the exit code is 1,
so a bad run can never wipe the blog.
"""
import json
import os
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

OUT = Path(__file__).resolve().parent / "blog_posts.json"


def _get(url, key, opener=urlopen):
    req = Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"})
    with opener(req, timeout=30) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status} from {url}")
        return json.loads(r.read().decode("utf8"))


def fetch(base_url, key, opener=urlopen):
    base = base_url.rstrip("/")
    cols = "id,slug,title,excerpt,body,cover_image_url,tags,published_at,updated_at,author_id"
    rows = _get(f"{base}/rest/v1/posts?select={cols}&status=eq.published&order=published_at.desc&limit=1000", key, opener)
    if not isinstance(rows, list):
        raise RuntimeError("unexpected response from the posts endpoint")
    ids = sorted({r["author_id"] for r in rows if r.get("author_id")})
    authors = {}
    if ids:
        in_list = quote("(" + ",".join(ids) + ")", safe="(),-")
        for a in _get(f"{base}/rest/v1/public_authors?select=id,display_name,bio,affiliation&id=in.{in_list}", key, opener):
            authors[a["id"]] = a
    out = []
    for r in rows:
        a = authors.get(r.get("author_id"), {})
        out.append({
            "id": r["id"], "slug": r["slug"], "title": r["title"], "excerpt": r.get("excerpt") or "", "body": r.get("body") or "",
            "cover": r.get("cover_image_url"), "tags": r.get("tags") or [], "published_at": r.get("published_at"),
            "updated_at": r.get("updated_at"),
            "author": {"name": a.get("display_name") or "IMRC", "bio": a.get("bio") or "", "affiliation": a.get("affiliation") or ""},
        })
    return out


def main():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_ANON_KEY.", file=sys.stderr)
        return 1
    try:
        posts = fetch(url, key)
    except (URLError, RuntimeError, ValueError, KeyError) as e:
        print(f"Could not fetch posts, keeping the existing file: {e}", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"Saved {len(posts)} published post(s) to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
