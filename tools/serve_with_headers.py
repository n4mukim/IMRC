"""Serve site/ locally WITH the production security headers, to check that the CSP does not break any page.
   python3 tools/serve_with_headers.py [port]   (default 8090)"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import security_headers

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        for k, v in security_headers.HEADERS.items():
            if k != "Strict-Transport-Security": self.send_header(k, v)
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
ThreadingHTTPServer(("127.0.0.1", port), partial(H, directory=str(Path(__file__).parent.parent / "site"))).serve_forever()
