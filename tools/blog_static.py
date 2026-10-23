"""Static pages for published blog posts: /blog/<slug>/, the RSS feed and sitemap entries.

Why static: search engines and social-media crawlers do not run JavaScript, so per-post titles, descriptions and
Open Graph images have to be in the HTML itself. Posts live in the database; `fetch_posts.py` copies the PUBLISHED ones
into tools/blog_posts.json and `build.py` turns that file into pages. Re-run the build whenever a post is published,
edited or unpublished (see BLOG-SETUP.md for the automatic rebuild hook).
"""
import json
import re
import shutil
from datetime import datetime, timezone
from email.utils import format_datetime
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlparse

from common import BASE_URL, SITE, btn, icon, page, state

POSTS_JSON = Path(__file__).resolve().parent / "blog_posts.json"
MANIFEST = SITE / "blog" / ".generated"
DEFAULT_OG = "/img/img1.jpg"
RESERVED = {"write", "post", "join", "review", "dashboard", "feed", "feed-xml", "index"}   # app pages that live under /blog/

# ---------------------------------------------------------------- sanitiser (allow-list; mirrors the browser and the database rules)
ALLOWED = {"p", "h2", "h3", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "img", "br"}
VOID = {"br", "img"}
DROP_WITH_CONTENT = {"script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "form", "textarea", "select", "button"}
SAFE_LINK = re.compile(r"^(https?:|mailto:)", re.I)
SAFE_IMG = re.compile(r"^(https://|/|data:image/(png|jpe?g|webp|gif);base64,)", re.I)


class _Clean(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.open = [], 0, []

    def handle_starttag(self, tag, attrs):
        if self.skip:
            if tag in DROP_WITH_CONTENT:
                self.skip += 1
            return
        if tag in DROP_WITH_CONTENT:
            self.skip = 1
            return
        if tag not in ALLOWED:
            return
        a = dict((k.lower(), v or "") for k, v in attrs)
        if tag == "a":
            href = a.get("href", "").strip()
            if not SAFE_LINK.match(href):
                return  # drop the tag, keep the text
            self.out.append(f'<a href="{escape(href, quote=True)}" rel="noopener noreferrer nofollow" target="_blank">')
        elif tag == "img":
            src = a.get("src", "").strip()
            if not SAFE_IMG.match(src):
                return
            self.out.append(f'<img src="{escape(src, quote=True)}" alt="{escape(a.get("alt", ""), quote=True)}" loading="lazy">')
            return
        elif tag == "br":
            self.out.append("<br>")
            return
        else:
            self.out.append(f"<{tag}>")
        self.open.append(tag)

    def handle_endtag(self, tag):
        if self.skip:
            if tag in DROP_WITH_CONTENT:
                self.skip -= 1
            return
        if tag in self.open:
            while self.open:
                t = self.open.pop()
                self.out.append(f"</{t}>")
                if t == tag:
                    break

    def handle_data(self, data):
        if not self.skip:
            self.out.append(escape(data, quote=False))

    def close(self):
        super().close()
        while self.open:
            self.out.append(f"</{self.open.pop()}>")


def sanitize_html(html: str) -> str:
    p = _Clean()
    p.feed(html or "")
    p.close()
    return "".join(p.out)


def text_of(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", sanitize_html(html))).strip()


def abs_url(u: str) -> str:
    return u if u.startswith("http") else BASE_URL + u


# ---------------------------------------------------------------- data
def load_posts(path: Path = POSTS_JSON):
    if not path.exists():
        return []
    posts = json.loads(path.read_text(encoding="utf8"))
    ok = []
    for p in posts:
        slug = p.get("slug") or ""
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug) or slug in RESERVED:
            continue  # never build a page from a malformed or reserved address (it would overwrite an app page)
        ok.append(p)
    return sorted(ok, key=lambda p: p.get("published_at") or "", reverse=True)


def fmt_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%b %-d, %Y")
    except Exception:
        return ""


def excerpt_of(p) -> str:
    return (p.get("excerpt") or text_of(p.get("body", ""))[:180]).strip()


def reading_minutes(p) -> int:
    return max(1, round(len(text_of(p.get("body", "")).split()) / 200))


# ---------------------------------------------------------------- cards (also pre-rendered on /blog/ so crawlers see them)
def card_html(p) -> str:
    cover = p.get("cover")
    img = (f'<span class="bcard-img" style="background-image:url(\'{escape(cover, quote=True)}\')" role="img" aria-label=""></span>'
           if cover and cover.startswith("https://") else '<span class="bcard-img bcard-ph" aria-hidden="true"></span>')
    tags = "".join(f'<span class="tag">{escape(t)}</span>' for t in (p.get("tags") or [])[:3])
    author = escape((p.get("author") or {}).get("name") or "IMRC")
    data_tags = escape(",".join(p.get("tags") or []), quote=True)
    return (f'<a class="bcard" href="/blog/{p["slug"]}/" data-tags="{data_tags}">{img}<span class="bcard-body">'
            f'{f"<span class=btags>{tags}</span>" if tags else ""}<h3>{escape(p["title"])}</h3><p>{escape(excerpt_of(p))}</p>'
            f'<span class="meta">{author} · {escape(fmt_date(p.get("published_at", "")))}</span></span></a>')


def cards_html(posts, limit=9) -> str:
    return "".join(card_html(p) for p in posts[:limit])


# ---------------------------------------------------------------- one post page
def render_post(p, posts):
    slug = p["slug"]
    path = f"/blog/{slug}/"
    url = BASE_URL + path
    title = p["title"]
    desc = excerpt_of(p)[:300]
    author = p.get("author") or {}
    name = author.get("name") or "IMRC"
    cover = p.get("cover") if (p.get("cover") or "").startswith("https://") else None
    og_img = cover or DEFAULT_OG
    body = sanitize_html(p.get("body", ""))
    tags = p.get("tags") or []
    related = [x for x in posts if x["slug"] != slug and set(x.get("tags") or []) & set(tags)][:3]

    share_url = quote(url, safe="")
    share_t = quote(title, safe="")
    share = (f'<p class="share"><span class="small muted">Share:</span> '
             f'<a href="mailto:?subject={share_t}&amp;body={share_url}">Email</a>'
             f'<a href="https://www.linkedin.com/sharing/share-offsite/?url={share_url}" target="_blank" rel="noopener noreferrer">LinkedIn</a>'
             f'<a href="https://www.facebook.com/sharer/sharer.php?u={share_url}" target="_blank" rel="noopener noreferrer">Facebook</a>'
             f'<button type="button" class="chipbtn" data-copy="{escape(url, quote=True)}">Copy link</button></p>')
    author_card = (f'<aside class="author-card"><strong>{escape(name)}</strong>'
                   + (f'<br><span class="muted small">{escape(author["affiliation"])}</span>' if author.get("affiliation") else "")
                   + (f'<p class="small">{escape(author["bio"])}</p>' if author.get("bio") else "") + "</aside>")
    rel_html = ""
    if related:
        rel_html = (f'<section class="section" style="padding-top:0"><div class="wrap"><h2 class="h3" style="margin-bottom:1.2rem">Related posts</h2>'
                    f'<div class="bgrid">{cards_html(related, 3)}</div></div></section>')
    tag_html = ("<p class=\"btags\">" + "".join(f'<a class="tag" href="/blog/?tag={quote(t)}">{escape(t)}</a>' for t in tags) + "</p>") if tags else ""
    body_html = f'''<section class="section" style="padding-top:clamp(32px,5vw,56px)"><div class="wrap-narrow">
<p><a class="link-arrow" href="/blog/">{icon("arrow-right", "ic").replace("<svg ", '<svg style="transform:rotate(180deg)" ')} All posts</a></p>
<article class="prose-blog" itemscope itemtype="https://schema.org/BlogPosting">
<h1 class="h2" itemprop="headline" style="margin:1rem 0 1rem">{escape(title)}</h1>
<p class="meta"><span itemprop="author">{escape(name)}</span> · <time datetime="{escape(p.get("published_at", ""))}" itemprop="datePublished">{escape(fmt_date(p.get("published_at", "")))}</time> · {reading_minutes(p)} min read</p>
{f'<img class="post-cover" src="{escape(cover, quote=True)}" alt="">' if cover else ""}
<div class="blog-body" itemprop="articleBody">{body}</div>
{tag_html}{author_card}
<p class="notice" role="note">This post is for education and is not a substitute for professional assessment or treatment. Views are the author’s own.</p>
{share}
</article></div></section>{rel_html}'''

    ld = [{
        "@context": "https://schema.org", "@type": "BlogPosting", "headline": title, "description": desc,
        "datePublished": p.get("published_at"), "dateModified": p.get("updated_at") or p.get("published_at"),
        "author": {"@type": "Person", "name": name}, "image": abs_url(og_img), "mainEntityOfPage": url,
        "publisher": {"@type": "Organization", "name": "IMRC", "logo": {"@type": "ImageObject", "url": BASE_URL + "/assets/logo-mark.png"}},
        "keywords": ", ".join(tags),
    }]
    state["lang"] = "en"
    html = page(path, title, desc, body_html, translated=False, jsonld=ld,
                crumbs=[("Home", "/"), ("Blog", "/blog/"), (title, path)], lang_notice=False,
                og={"type": "article", "image": abs_url(og_img), "published": p.get("published_at") or ""},
                scripts="")
    return path, html


# ---------------------------------------------------------------- feed + sitemap
def render_feed(posts) -> str:
    items = []
    for p in posts[:30]:
        url = f"{BASE_URL}/blog/{p['slug']}/"
        try:
            pub = format_datetime(datetime.fromisoformat(p["published_at"].replace("Z", "+00:00")))
        except Exception:
            pub = format_datetime(datetime.now(timezone.utc))
        name = (p.get("author") or {}).get("name") or "IMRC"
        cats = "".join(f"<category>{escape(t)}</category>" for t in (p.get("tags") or []))
        items.append(
            f"<item><title>{escape(p['title'])}</title><link>{url}</link><guid isPermaLink=\"true\">{url}</guid>"
            f"<pubDate>{pub}</pubDate><dc:creator>{escape(name)}</dc:creator>{cats}"
            f"<description>{escape(excerpt_of(p))}</description>"
            f"<content:encoded><![CDATA[{sanitize_html(p.get('body', '')).replace(']]>', ']]&gt;')}]]></content:encoded></item>")
    last = format_datetime(datetime.now(timezone.utc))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>'
            f'<title>IMRC Blog</title><link>{BASE_URL}/blog/</link><description>Plain-language writing on culture, mental health and resilience from the IMRC community.</description>'
            f'<language>en-ca</language><lastBuildDate>{last}</lastBuildDate><atom:link href="{BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/>'
            + "".join(items) + "</channel></rss>\n")


def sitemap_entries(posts):
    out = []
    for p in posts:
        lm = (p.get("updated_at") or p.get("published_at") or "")[:10]
        out.append(f"<url><loc>{BASE_URL}/blog/{p['slug']}/</loc>" + (f"<lastmod>{lm}</lastmod>" if lm else "") + "</url>")
    return out


# ---------------------------------------------------------------- write everything; remove pages for posts that are no longer published
def write_all(posts, write):
    keep = {p["slug"] for p in posts}
    old = set(MANIFEST.read_text(encoding="utf8").split()) if MANIFEST.exists() else set()
    for slug in old - keep:                      # unpublished or deleted: the page must disappear (404)
        shutil.rmtree(SITE / "blog" / slug, ignore_errors=True)
    for p in posts:
        path, html = render_post(p, posts)
        write(path.strip("/") + "/index.html", html)
    write("blog/feed.xml", render_feed(posts))
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text("\n".join(sorted(keep)), encoding="utf8")
    return len(posts)
