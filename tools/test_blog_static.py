import json
import sys
import tempfile
import threading
import unittest
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_static as bs
import fetch_posts as fp


def post(**kw):
    base = {"id": "1", "slug": "grief-across-cultures", "title": "Grief across cultures", "excerpt": "How mourning differs.",
            "body": "<h2>Intro</h2><p>Hello <strong>bold</strong> and <em>italic</em>.</p>", "cover": None, "tags": ["grief", "culture"],
            "published_at": "2026-10-01T12:00:00+00:00", "updated_at": "2026-10-02T12:00:00+00:00",
            "author": {"name": "Mina Park", "bio": "Counsellor", "affiliation": "Independent"}}
    base.update(kw)
    return base


class Sanitiser(unittest.TestCase):
    def test_keeps_editor_formatting(self):
        h = '<h2>H</h2><h3>S</h3><p><strong>b</strong><em>i</em><u>u</u></p><ul><li>x</li></ul><ol><li>y</li></ol><blockquote>q</blockquote><a href="https://example.org">l</a><img src="https://x.test/a.webp" alt="d">'
        out = bs.sanitize_html(h)
        for frag in ("<h2>H</h2>", "<h3>S</h3>", "<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<ul><li>x</li></ul>", "<blockquote>q</blockquote>", 'alt="d"', 'href="https://example.org"'):
            self.assertIn(frag, out)

    def test_removes_scripts_handlers_and_bad_urls(self):
        evil = ('<p onclick="x()">a</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">j</a>'
                '<iframe src="https://evil.test">inside</iframe><a href="data:text/html;base64,PHNjcmlwdD4=">d</a><img src="javascript:alert(4)">'
                '<style>body{display:none}</style><svg onload="x()"><circle/></svg><form action="/x"><input></form>')
        out = bs.sanitize_html(evil)
        for bad in ("script", "onclick", "onerror", "javascript:", "iframe", "inside", "data:text/html", "<style", "display:none", "<svg", "onload", "<form", "<input"):
            self.assertNotIn(bad, out, bad)
        self.assertIn("<p>a</p>", out)
        self.assertIn("j", out)          # the link text survives, the link does not

    def test_escapes_text_and_closes_tags(self):
        self.assertEqual(bs.sanitize_html("<p>1 < 2 & 3"), "<p>1 &lt; 2 &amp; 3</p>")

    def test_external_links_are_safe(self):
        out = bs.sanitize_html('<a href="https://example.org" target="_self" onclick="x">x</a>')
        self.assertIn('rel="noopener noreferrer nofollow"', out)
        self.assertNotIn("onclick", out)


class Pages(unittest.TestCase):
    def test_load_skips_malformed_and_reserved_slugs(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "p.json"
            f.write_text(json.dumps([post(), post(slug="Bad Slug"), post(slug="../etc"), post(slug="write"), post(slug="dashboard"), post(slug="")]))
            self.assertEqual([p["slug"] for p in bs.load_posts(f)], ["grief-across-cultures"])

    def test_post_page_has_seo_meta_and_structured_data(self):
        p = post(cover="https://cdn.test/cover.webp")
        path, html = bs.render_post(p, [p])
        self.assertEqual(path, "/blog/grief-across-cultures/")
        for frag in ('<title>Grief across cultures · IMRC</title>', 'rel="canonical" href="https://culturalresilience.org/blog/grief-across-cultures/"',
                     'property="og:type" content="article"', 'property="og:image" content="https://cdn.test/cover.webp"',
                     'content="How mourning differs."', "article:published_time", '"@type": "BlogPosting"', "BreadcrumbList", "<h1 ", "min read",
                     "not a substitute for professional assessment", "linkedin.com/sharing"):
            self.assertIn(frag, html, frag)
        self.assertNotIn("noindex", html)

    def test_post_without_cover_uses_the_default_share_image(self):
        _, html = bs.render_post(post(), [post()])
        self.assertIn('property="og:image" content="https://culturalresilience.org/img/img1.jpg"', html)

    def test_hostile_content_cannot_break_the_page(self):
        p = post(title='"><script>alert(1)</script>', excerpt='x" onload="y', body='<p>ok</p><script>alert(2)</script>', tags=['"><b>'], author={"name": "<img src=x onerror=1>", "bio": "<script>x</script>", "affiliation": ""})
        _, html = bs.render_post(p, [p])
        self.assertNotIn("<script>alert", html)
        self.assertNotIn("<img src=x onerror", html)
        self.assertNotIn('onload="y', html.split("</head>")[0].replace('content="x&quot; onload=&quot;y"', ""))

    def test_related_posts_share_a_tag(self):
        a, b, c = post(), post(slug="other", title="Other", tags=["culture"]), post(slug="unrelated", title="Unrelated", tags=["sleep"])
        _, html = bs.render_post(a, [a, b, c])
        self.assertIn("/blog/other/", html)
        self.assertNotIn("/blog/unrelated/", html)

    def test_cards_link_to_the_static_page(self):
        self.assertIn('href="/blog/grief-across-cultures/"', bs.cards_html([post()]))

    def test_feed_is_valid_xml_with_full_items(self):
        evil = post(slug="x", title="A & B", body="<p>ends ]]> here</p><script>1</script>")
        xml = bs.render_feed([post(), evil])
        root = ET.fromstring(xml)
        items = root.findall("./channel/item")
        self.assertEqual(len(items), 2)
        self.assertEqual(items[1].find("title").text, "A & B")
        self.assertIn("https://culturalresilience.org/blog/grief-across-cultures/", items[0].find("link").text)
        self.assertNotIn("<script>", xml)

    def test_sitemap_entries(self):
        e = bs.sitemap_entries([post()])
        self.assertEqual(e, ["<url><loc>https://culturalresilience.org/blog/grief-across-cultures/</loc><lastmod>2026-10-02</lastmod></url>"])


class Cleanup(unittest.TestCase):
    def test_unpublished_posts_lose_their_page(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            old_site, old_manifest = bs.SITE, bs.MANIFEST
            bs.SITE, bs.MANIFEST = root, root / "blog" / ".generated"
            try:
                def write(rel, html):
                    f = root / rel
                    f.parent.mkdir(parents=True, exist_ok=True)
                    f.write_text(html, encoding="utf8")
                a, b = post(), post(slug="second", title="Second")
                bs.write_all([a, b], write)
                self.assertTrue((root / "blog/second/index.html").exists())
                (root / "blog/write").mkdir(parents=True)
                (root / "blog/write/index.html").write_text("app page")
                bs.write_all([a], write)                       # "second" was unpublished
                self.assertFalse((root / "blog/second").exists())
                self.assertTrue((root / "blog/grief-across-cultures/index.html").exists())
                self.assertEqual((root / "blog/write/index.html").read_text(), "app page")   # app pages are never touched
            finally:
                bs.SITE, bs.MANIFEST = old_site, old_manifest


class Fetch(unittest.TestCase):
    def serve(self, handler):
        srv = HTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.shutdown)
        return f"http://127.0.0.1:{srv.server_port}"

    def test_fetch_maps_rows_and_authors_and_sends_only_the_public_key(self):
        seen = []

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                seen.append((self.path, self.headers.get("apikey")))
                body = ([{"id": "p1", "slug": "hello", "title": "Hello", "excerpt": None, "body": "<p>x</p>", "cover_image_url": None, "tags": None,
                          "published_at": "2026-10-01T00:00:00Z", "updated_at": None, "author_id": "a1"}] if "/posts" in self.path
                        else [{"id": "a1", "display_name": "Mina", "bio": "B", "affiliation": "A"}])
                data = json.dumps(body).encode()
                self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(data)
        out = fp.fetch(self.serve(H), "anon-key")
        self.assertEqual(out[0]["author"]["name"], "Mina")
        self.assertEqual(out[0]["tags"], [])
        self.assertTrue(any("status=eq.published" in p for p, _ in seen))
        self.assertTrue(all(k == "anon-key" for _, k in seen))

    def test_a_server_error_raises_and_never_writes(self):
        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                self.send_response(500); self.end_headers()
        with self.assertRaises(Exception):
            fp.fetch(self.serve(H), "k")


if __name__ == "__main__":
    unittest.main()
