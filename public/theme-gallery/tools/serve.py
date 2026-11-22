"""Static server for the gallery that copes with many parallel screenshot runs."""

import functools
import http.server
import os
import sys


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 256


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 4400
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
handler = functools.partial(Handler, directory=root)

with Server(("127.0.0.1", port), handler) as server:
    print(f"Serving {root} at http://localhost:{port}")
    server.serve_forever()
