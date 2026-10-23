"""One source of truth for the site's security headers (written to _headers and vercel.json by build.py).

The CSP is strict on purpose: no inline scripts, no eval, no third-party scripts except the two pinned CDN files and
Cloudflare Turnstile, no object/embed, no framing. If you add a new third-party service (form endpoint, analytics),
add its host here and rebuild: tools/test_security.py checks that every external script the pages load is allowed.
"""
import os

SCRIPT_HOSTS = ["https://cdn.jsdelivr.net", "https://challenges.cloudflare.com"]
EXTRA_CONNECT = [h for h in os.environ.get("EXTRA_CONNECT_SRC", "").split() if h.startswith("https://")]  # e.g. your form service

CSP_PARTS = {
    "default-src": ["'self'"],
    "script-src": ["'self'"] + SCRIPT_HOSTS,
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],   # inline style="" attributes are used for layout
    "font-src": ["https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co"],                       # uploaded post images live in Supabase Storage
    "connect-src": ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://challenges.cloudflare.com"] + EXTRA_CONNECT,
    "frame-src": ["https://challenges.cloudflare.com"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
}
CSP = "; ".join(f"{k} {' '.join(v)}" for k, v in CSP_PARTS.items()) + "; upgrade-insecure-requests"

HEADERS = {
    "Content-Security-Policy": CSP,
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
LONG_CACHE = "public, max-age=31536000, immutable"   # css/js are versioned with ?v=, images and assets rarely change


def headers_file() -> str:
    """Netlify / Cloudflare Pages `_headers` format."""
    out = ["/*"] + [f"  {k}: {v}" for k, v in HEADERS.items()]
    for path in ("/css/*", "/js/*", "/img/*", "/assets/*"):
        out += ["", path, f"  Cache-Control: {LONG_CACHE}"]
    return "\n".join(out) + "\n"


def vercel_headers() -> list:
    rules = [{"source": "/(.*)", "headers": [{"key": k, "value": v} for k, v in HEADERS.items()]}]
    for path in ("/css/(.*)", "/js/(.*)", "/img/(.*)", "/assets/(.*)"):
        rules.append({"source": path, "headers": [{"key": "Cache-Control", "value": LONG_CACHE}]})
    return rules
