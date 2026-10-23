"""Static checks on the built site: security (CSP-compatible markup, SRI, no secrets) and SEO basics.
Run after building:  python3 tools/build.py && python3 -m unittest tools/test_security.py"""
import re, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import security_headers

SITE = Path(__file__).parent.parent / "site"
PAGES = sorted(p for p in SITE.rglob("*.html") if "research" not in p.parts)
ALLOWED_SCRIPT_HOSTS = tuple(security_headers.SCRIPT_HOSTS)


def read(p): return p.read_text(encoding="utf8")


class Security(unittest.TestCase):
    def test_no_inline_scripts_or_handlers(self):
        for p in PAGES:
            h = read(p)
            for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", h, re.S):
                if 'type="application/ld+json"' in m.group(1): continue      # data block, not executable
                self.assertIn("src=", m.group(1), f"inline script in {p}")
                self.assertEqual(m.group(2).strip(), "", f"script with src and body in {p}")
            self.assertIsNone(re.search(r"\son[a-z]+\s*=\s*[\"']", h), f"inline event handler in {p}")
            self.assertNotIn("javascript:", h.lower(), f"javascript: URL in {p}")

    def test_external_scripts_are_allow_listed_and_pinned_with_sri(self):
        for p in PAGES:
            for m in re.finditer(r"<script\b[^>]*\bsrc=\"(https?://[^\"]+)\"[^>]*>", read(p)):
                url, tag = m.group(1), m.group(0)
                self.assertTrue(url.startswith(ALLOWED_SCRIPT_HOSTS), f"{url} not allowed by CSP ({p})")
                if "cdn.jsdelivr.net" in url:
                    self.assertRegex(url, r"@\d+\.\d+\.\d+/", f"unpinned CDN version {url}")
                    self.assertIn('integrity="sha384-', tag, f"no SRI on {url}")
                    self.assertIn('crossorigin="anonymous"', tag)

    def test_new_tab_links_have_noopener(self):
        for p in PAGES:
            for m in re.finditer(r"<a\b[^>]*target=\"_blank\"[^>]*>", read(p)):
                self.assertIn("noopener", m.group(0), f"{p}: {m.group(0)}")

    def test_no_secrets_in_site(self):
        for p in SITE.rglob("*"):
            if not p.is_file() or p.suffix in (".jpg", ".png", ".webp", ".woff2", ".ico"): continue
            t = read(p)
            self.assertNotIn("service_role", t.replace("service_role_key_never_here", ""), f"service_role mentioned in {p}")
            self.assertIsNone(re.search(r"SUPABASE_SERVICE_ROLE_KEY|sk_live_|re_[A-Za-z0-9]{20,}", t), f"secret-looking string in {p}")
            for jwt in re.findall(r"eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}", t):
                import base64, json
                payload = json.loads(base64.urlsafe_b64decode(jwt.split(".")[1] + "=="))
                self.assertNotEqual(payload.get("role"), "service_role", f"service-role JWT in {p}")

    def test_headers_files_match_policy(self):
        h = read(SITE / "_headers")
        self.assertIn(security_headers.CSP, h)
        self.assertNotIn("'unsafe-eval'", security_headers.CSP)
        self.assertNotRegex(security_headers.CSP.split("style-src")[0], "unsafe-inline")      # scripts never get unsafe-inline
        self.assertIn("frame-ancestors 'none'", security_headers.CSP)
        self.assertIn("object-src 'none'", security_headers.CSP)


class SEO(unittest.TestCase):
    def pages(self): return [p for p in PAGES if p.name != "404.html"]

    def test_title_description_canonical_h1(self):
        titles = {}
        for p in self.pages():
            h = read(p)
            t = re.search(r"<title>(.*?)</title>", h, re.S)
            self.assertTrue(t and 5 < len(t.group(1)) <= 90, f"title length {p}")
            self.assertRegex(h, r'<meta name="description" content="[^"]{20,}', f"description {p}")
            self.assertRegex(h, r'<link rel="canonical" href="https://', f"canonical {p}")
            n = len(re.findall(r"<h1[\s>]", h))
            if "noindex" in h: self.assertGreaterEqual(n, 1, f"h1 {p}")      # app pages swap between mutually exclusive panels (gate / editor / list); one is visible at a time
            else: self.assertEqual(n, 1, f"h1 count {p}")
            if "noindex" not in h:
                self.assertNotIn(t.group(1), titles, f"duplicate title {p} / {titles.get(t.group(1))}")
                titles[t.group(1)] = p

    def test_images_have_alt(self):
        for p in self.pages():
            for m in re.finditer(r"<img\b[^>]*>", read(p)):
                self.assertIn("alt=", m.group(0), f"{p}: {m.group(0)[:80]}")

    def test_noindex_pages_not_in_sitemap(self):
        sm = read(SITE / "sitemap.xml")
        for p in self.pages():
            if 'content="noindex' in read(p) or "noindex" in re.findall(r'<meta name="robots" content="([^"]*)"', read(p)):
                url = "/" + str(p.relative_to(SITE)).replace("index.html", "")
                self.assertFalse(re.search(rf"<loc>[^<]*{re.escape(url)}</loc>", sm), f"{url} is noindex but in sitemap")

    def test_html_lang_matches_folder(self):
        for p in self.pages():
            rel = p.relative_to(SITE).parts
            want = rel[0] if rel[0] in ("ko", "ja") else "en"
            self.assertRegex(read(p), rf'<html lang="{want}"', str(p))


if __name__ == "__main__":
    unittest.main()
