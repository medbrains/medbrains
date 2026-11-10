#!/usr/bin/env python3
"""Serves a folder over HTTPS for the update tests: `serve-bundles.py DIR PORT CERT KEY`."""
import http.server
import os
import ssl
import sys


class Quiet(http.server.SimpleHTTPRequestHandler):
    """Serves files and logs nothing."""

    def log_message(self, *_):
        """Stays silent: the test reads the machine, not this server."""


def main():
    """Serves until the test ends it."""
    folder, port, cert, key = sys.argv[1:5]
    os.chdir(folder)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", int(port)), Quiet)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
