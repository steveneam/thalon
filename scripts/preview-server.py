#!/usr/bin/env python3
"""No-cache static preview server for the template portfolio.

Replaces `python3 -m http.server` for founder review: identical serving,
plus `Cache-Control: no-cache` on every response so browsers revalidate
instead of heuristically caching — review rounds that replace same-named
assets (the s55 lesson) can never show stale bytes again.

Usage:  python3 scripts/preview-server.py [port] [directory]
Defaults: port 8899, directory proprietary/templates/sites/ (repo-relative).
Binds 127.0.0.1 only, matching the stealth posture.
"""
import functools
import http.server
import pathlib
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # quiet by default
        pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    default_dir = pathlib.Path(__file__).resolve().parent.parent / "proprietary" / "templates" / "sites"
    directory = sys.argv[2] if len(sys.argv) > 2 else str(default_dir)
    handler = functools.partial(NoCacheHandler, directory=directory)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"preview-server: http://127.0.0.1:{port}/ serving {directory} (no-cache)")
    server.serve_forever()


if __name__ == "__main__":
    main()
