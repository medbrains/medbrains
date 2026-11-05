#!/usr/bin/env python3
"""Attacks the front on a machine that is ours, with `front_recorder` in the server's place, and
reads back what the recorder saw. A smuggled request is one that reaches the recorder.

  front-attacks.py --tls HOST:PORT --http HOST:PORT [--slow] [--flood] [--big]

--slow adds the attacks that take over a minute, --flood the connection flood, --big the 257 MiB
chunked upload. Exits non-zero if any attack succeeded. Never point this at a machine you do not own.
"""
import argparse, socket, ssl, sys, threading, time

CANARY = "/SMUGGLED"
FORGED_IP = "6.6.6.6"
FORGED_HOST = "evil.example"
SMUGGLE = f"GET {CANARY} HTTP/1.1\r\nHost: medbrains.local\r\n\r\n"
HOST = "Host: medbrains.local\r\n"
failed = []


def context(**options):
    """A TLS context that does not check who it talks to: the front's certificate is our own."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    for key, value in options.items():
        setattr(ctx, key, value)
    return ctx


def connect(args, timeout=8):
    """A new TLS connection to the front."""
    raw = socket.create_connection(args.tls, timeout=timeout)
    return context().wrap_socket(raw, server_hostname="medbrains.local")


def read_all(sock, limit=8):
    """Everything until the connection closes or goes quiet, and whether it closed."""
    data, deadline, closed = b"", time.time() + limit, False
    sock.settimeout(0.5)
    while time.time() < deadline:
        try:
            chunk = sock.recv(65536)
        except (TimeoutError, socket.timeout, ssl.SSLWantReadError):
            if data:
                break
            continue
        except OSError:
            closed = True
            break
        if not chunk:
            closed = True
            break
        data += chunk
    return data, closed


def exchange(args, raw):
    """Sends raw bytes on a new connection and returns the status line's code and the answer."""
    with connect(args) as sock:
        sock.sendall(raw.encode("latin-1") if isinstance(raw, str) else raw)
        data, _ = read_all(sock)
    parts = data.split(b" ", 2)
    return (int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0), data


def clean_request(args, path):
    """A well-formed GET, for talking to the recorder."""
    return exchange(args, f"GET {path} HTTP/1.1\r\n{HOST}Connection: close\r\n\r\n")


def seen(args):
    """What the recorder has been sent."""
    return clean_request(args, "/__seen")[1].decode("latin-1").split("\r\n\r\n", 1)[-1]


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + str(detail)[:300] if not ok else ''}", flush=True)
    if not ok:
        failed.append(name)


def smuggling_cases():
    """Requests two parsers could read two ways. Each hides the canary in what a body might be."""
    post = "POST /api/x HTTP/1.1\r\n" + HOST
    chunk_end = "0\r\n\r\n"
    yield "CL.TE", f"{post}Content-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n{chunk_end}{SMUGGLE}"
    yield "TE.CL", f"{post}Transfer-Encoding: chunked\r\nContent-Length: 4\r\n\r\n5c\r\n{SMUGGLE}\r\n{chunk_end}"
    yield "duplicate Content-Length", f"{post}Content-Length: 0\r\nContent-Length: {len(SMUGGLE)}\r\n\r\n{SMUGGLE}"
    yield "same Content-Length twice", f"{post}Content-Length: 0\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "Content-Length list", f"{post}Content-Length: 0, {len(SMUGGLE)}\r\n\r\n{SMUGGLE}"
    yield "Content-Length plus sign", f"{post}Content-Length: +0\r\n\r\n{SMUGGLE}"
    yield "Content-Length hex", f"{post}Content-Length: 0x0\r\n\r\n{SMUGGLE}"
    yield "TE obfuscated", f"{post}Transfer-Encoding: xchunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "TE with tab", f"{post}Transfer-Encoding:\tchunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "TE with space in name", f"{post}Transfer-Encoding : chunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "TE folded", f"{post}X: y\r\n Transfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "TE list", f"{post}Transfer-Encoding: chunked, identity\r\n\r\n{chunk_end}{SMUGGLE}"
    yield "TE on HTTP/1.0", f"POST /api/x HTTP/1.0\r\n{HOST}Transfer-Encoding: chunked\r\n\r\n{chunk_end}{SMUGGLE}"
    yield "bare LF heads", f"POST /api/x HTTP/1.1\nHost: a\nContent-Length: 0\n\n{SMUGGLE}"
    yield "bare LF in one header", f"{post}X: y\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "bare CR in one header", f"{post}X: y\rTransfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "NUL in a header", f"{post}X: y\0\r\nContent-Length: 0\r\n\r\n{SMUGGLE}"
    yield "absolute target", f"GET http://evil.example{CANARY} HTTP/1.1\r\n{HOST}\r\n"
    yield "h2c upgrade", f"GET /x HTTP/1.1\r\n{HOST}Connection: Upgrade, HTTP2-Settings\r\nUpgrade: h2c\r\nHTTP2-Settings: AAMAAABkAAQAoAAAAAIAAAAA\r\n\r\n{SMUGGLE}"
    yield "second Host", f"GET /x HTTP/1.1\r\n{HOST}Host: evil.example\r\n\r\n{SMUGGLE}"
    chunked = f"{post}Transfer-Encoding: chunked\r\n\r\n"
    yield "chunk size overflow", f"{chunked}10000000000000000\r\nhello\r\n{chunk_end}{SMUGGLE}"
    yield "chunk size hex prefix", f"{chunked}0x0\r\n\r\n{SMUGGLE}"
    yield "chunk size negative", f"{chunked}-1\r\n\r\n{SMUGGLE}"
    yield "chunk size bare LF", f"{chunked}0\n\n{SMUGGLE}"
    yield "chunk extension with LF", f"{chunked}0;a=b\nc\r\n\r\n{SMUGGLE}"
    yield "chunk data longer than its size", f"{chunked}1\r\nhello\r\n{chunk_end}{SMUGGLE}"
    yield "chunk with no ending", f"{chunked}5\r\nhelloXX0\r\n\r\n{SMUGGLE}"
    yield "pipelined after a body", f"{post}Content-Length: 2\r\n\r\nhi{SMUGGLE}"
    yield "pipelined after chunks", f"{chunked}2\r\nhi\r\n{chunk_end}{SMUGGLE}"


def attack_smuggling(args):
    """No case reaches the recorder as a second request, or as anything it cannot frame."""
    for name, raw in smuggling_cases():
        clean_request(args, "/__reset")
        status, _ = exchange(args, raw)
        got = seen(args)
        ok = CANARY not in got and "GARBAGE" not in got
        check(f"smuggling: {name} (answered {status})", ok, got)


def attack_forged_forwarding(args):
    """The server sees the connection's address, whatever the client claims."""
    clean_request(args, "/__reset")
    clean_request(args, "/plain")
    true_client = next((line.split(":", 1)[1].strip() for line in seen(args).splitlines()
                        if line.lower().startswith("x-forwarded-for:")), "")
    check("the recorder sees one client address", bool(true_client))
    forged = "".join(f"{name}: {FORGED_IP}\r\n" for name in [
        "X-Forwarded-For", "x-forwarded-for", "X-FORWARDED-FOR", "X-Real-IP", "Forwarded",
        "X-Forwarded-Host", "X-Client-IP", "X-Cluster-Client-IP"])
    # Asking for our own header to be dropped as hop-by-hop must not unset what we set.
    variants = {"forged": forged, "nominated": f"{forged}Connection: close, X-Forwarded-For, X-Real-IP\r\n"}
    for name, headers in variants.items():
        clean_request(args, "/__reset")
        status, _ = exchange(args, f"GET /f HTTP/1.1\r\n{HOST}{headers}\r\n")
        got = seen(args)
        lines = [line for line in got.splitlines() if line.lower().startswith("x-forwarded-for:")]
        kept = len(lines) == 1 and lines[0].split(":", 1)[1].strip() == true_client
        refused = status == 400 and not got.strip()
        check(f"forged address: {name} (answered {status})", FORGED_IP not in got and (kept or refused), got)


def attack_forged_host(args):
    """A forged Host reaches neither a redirect nor the server's link builder."""
    clean_request(args, "/__reset")
    exchange(args, f"GET /h HTTP/1.1\r\nHost: {FORGED_HOST}\r\nX-Forwarded-Host: {FORGED_HOST}\r\n\r\n")
    got = seen(args)
    check("forged Host does not reach the server", "/h " in got and FORGED_HOST not in got, got)
    for host in (FORGED_HOST, f"medbrains.local@{FORGED_HOST}", f"{FORGED_HOST}:80"):
        with socket.create_connection(args.http, timeout=8) as sock:
            sock.sendall(f"GET /login HTTP/1.1\r\nHost: {host}\r\n\r\n".encode())
            data, _ = read_all(sock, 4)
        location = next((line for line in data.decode("latin-1").splitlines()
                         if line.lower().startswith("location:")), "")
        bad_request = data.startswith(b"HTTP/1.1 400")
        check(f"redirect ignores Host {host}", bad_request or (location and FORGED_HOST not in location), data)
    with socket.create_connection(args.http, timeout=8) as sock:
        sock.sendall(f"GET /login?a=1 HTTP/1.1\r\n{HOST}\r\n".encode())
        data, _ = read_all(sock, 4)
    check("plain HTTP redirects with the path kept",
          data.startswith(b"HTTP/1.1 301") and b"https://medbrains.local/login?a=1" in data, data)


def attack_oversized(args):
    """Too much head is refused early, and the front stays up."""
    big = "X-Big: " + "a" * 40_000 + "\r\n"
    status, _ = exchange(args, f"GET / HTTP/1.1\r\n{HOST}{big}\r\n")
    check("a 40 KB header gets 431", status == 431, status)
    status, _ = exchange(args, f"GET /{'a' * 70_000} HTTP/1.1\r\n{HOST}\r\n")
    check("a 70 KB URL gets 431", status == 431, status)
    many = "X: y\r\n" * 200
    status, _ = exchange(args, f"GET / HTTP/1.1\r\n{HOST}{many}\r\n")
    check("200 headers get 400", status == 400, status)
    status, _ = exchange(args, f"POST / HTTP/1.1\r\n{HOST}Content-Length: 300000000\r\n\r\n")
    check("a declared 300 MB body gets 413", status == 413, status)
    status, _ = clean_request(args, "/still-up")
    check("the front still answers", status == 200, status)


def attack_slow_head(args):
    """One byte a second never completes a head, on a new or on a reused connection."""
    def trickle(sock, started):
        for byte in f"GET /slow HTTP/1.1\r\n{HOST}X-Pad: ".encode() + b"a" * 60:
            try:
                sock.sendall(bytes([byte]))
            except OSError:
                return time.time() - started
            sock.settimeout(1)
            try:
                if sock.recv(4096) == b"":
                    return time.time() - started
                return time.time() - started
            except (TimeoutError, socket.timeout, ssl.SSLWantReadError):
                pass
            except OSError:
                return time.time() - started
        return None

    with connect(args) as sock:
        took = trickle(sock, time.time())
    check(f"slowloris: closed after {took and round(took)} s", took is not None and took < 14, took)
    with connect(args) as sock:
        sock.sendall(f"GET /first HTTP/1.1\r\n{HOST}\r\n".encode())
        first, _ = read_all(sock, 3)
        took = trickle(sock, time.time())
    check(f"slowloris on a reused connection: closed after {took and round(took)} s",
          first.startswith(b"HTTP/1.1 200") and took is not None and took < 14, took)


def attack_slow_body(args):
    """A body trickling below the minimum rate is cut off."""
    started, closed_at = time.time(), None
    with connect(args) as sock:
        sock.sendall(f"POST /slow-body HTTP/1.1\r\n{HOST}Content-Length: 100000\r\n\r\n".encode())
        sock.settimeout(1)
        while time.time() - started < 60:
            try:
                sock.sendall(b"x")
                sock.recv(4096)
                closed_at = time.time() - started
                check(f"slow body: answered after {round(closed_at)} s", True)
                break
            except (TimeoutError, socket.timeout, ssl.SSLWantReadError):
                continue
            except OSError:
                closed_at = time.time() - started
                check(f"slow body: closed after {round(closed_at)} s", True)
                break
    if closed_at is None:
        check("slow body: cut off within a minute", False)


def attack_idle(args):
    """A connection that says nothing is closed."""
    started = time.time()
    with connect(args, timeout=100) as sock:
        sock.settimeout(100)
        try:
            sock.recv(1)
        except OSError:
            pass
    took = time.time() - started
    check(f"an idle connection closed after {round(took)} s", took < 90, took)


def attack_tls(args):
    """Old TLS and weak ciphers are refused; HTTP/2 cannot be negotiated."""
    def handshake(ctx):
        raw = socket.create_connection(args.tls, timeout=8)
        with ctx.wrap_socket(raw, server_hostname="medbrains.local") as sock:
            return sock.version(), sock.cipher()[0], sock.selected_alpn_protocol()

    def refused(ctx):
        try:
            return f"accepted {handshake(ctx)}"
        except (ssl.SSLError, OSError):
            return None

    for name, version in (("TLS 1.0", ssl.TLSVersion.TLSv1), ("TLS 1.1", ssl.TLSVersion.TLSv1_1)):
        ctx = context()
        ctx.minimum_version = version
        ctx.maximum_version = version
        ctx.set_ciphers("ALL:@SECLEVEL=0")
        check(f"{name} is refused", refused(ctx) is None, refused(ctx))
    ctx = context()
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    ctx.set_ciphers("AES128-SHA:AES256-SHA:DES-CBC3-SHA:RC4-SHA:NULL-SHA:@SECLEVEL=0")
    check("CBC, RC4, 3DES and NULL ciphers are refused", refused(ctx) is None, refused(ctx))
    ctx = context()
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    version, _, _ = handshake(ctx)
    check("TLS 1.2 works", version == "TLSv1.2", version)
    version, _, _ = handshake(context())
    check("TLS 1.3 works", version == "TLSv1.3", version)
    ctx = context()
    ctx.set_alpn_protocols(["h2", "http/1.1"])
    check("h2 is not chosen when offered", handshake(ctx)[2] == "http/1.1", handshake(ctx))
    ctx = context()
    ctx.set_alpn_protocols(["h2"])
    check("a client wanting only h2 is refused", refused(ctx) is None, refused(ctx))
    for name, garbage in (("random bytes", bytes(range(256))), ("plain HTTP on the TLS port", b"GET / HTTP/1.1\r\n\r\n"),
                          ("a truncated hello", b"\x16\x03\x01\x02\x00\x01\x00\x01\xfc\x03\x03")):
        with socket.create_connection(args.tls, timeout=8) as sock:
            sock.sendall(garbage)
            data, _ = read_all(sock, 2)
        check(f"{name} gets no HTTP answer", b"HTTP" not in data, data)
    check("the front still answers", clean_request(args, "/still-up")[0] == 200)


def attack_websocket_and_streaming(args):
    """What must keep working under these rules."""
    with connect(args) as sock:
        sock.sendall(f"GET /__ws HTTP/1.1\r\n{HOST}Connection: Upgrade\r\nUpgrade: websocket\r\n"
                     "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        head, _ = read_all(sock, 3)
        check("a WebSocket upgrade gets 101", head.startswith(b"HTTP/1.1 101"), head)
        # Longer than every read limit a normal request has.
        time.sleep(args.ws_idle)
        sock.settimeout(5)
        sock.sendall(b"ping")
        try:
            echoed = sock.recv(16)
        except OSError as error:
            echoed = repr(error).encode()
        check(f"a WebSocket stays open through {args.ws_idle} s of silence", echoed == b"ping", echoed)
    with connect(args) as sock:
        sock.sendall(f"GET /__stream HTTP/1.1\r\n{HOST}Connection: close\r\n\r\n".encode())
        sock.settimeout(5)
        started, first_byte = time.time(), None
        total = b""
        while True:
            try:
                chunk = sock.recv(4096)
            except OSError:
                break
            if not chunk:
                break
            if b"one" in chunk and first_byte is None:
                first_byte = time.time() - started
            total += chunk
        whole = time.time() - started
    check(f"a stream's first chunk comes at once ({first_byte and round(first_byte, 2)} s of {round(whole, 2)} s)",
          first_byte is not None and first_byte < 0.9 and whole > 2 and b"tri" in total, total)


def attack_big_chunked(args):
    """A chunked upload past the limit stops at the limit, with no length to refuse in advance."""
    mib = b"100000\r\n" + b"x" * (1024 * 1024) + b"\r\n"
    with connect(args, timeout=30) as sock:
        sock.sendall(f"POST /big HTTP/1.1\r\n{HOST}Transfer-Encoding: chunked\r\n\r\n".encode())
        sent = 0
        try:
            for sent in range(1, 258):
                sock.sendall(mib)
            sock.sendall(b"0\r\n\r\n")
        except OSError:
            pass
        data, _ = read_all(sock, 10)
    check(f"chunked upload stopped at the limit (sent {sent} MiB)", sent < 258 and b" 200 " not in data[:20], data[:200])


def attack_flood(args):
    """Thousands of held connections: the front stays alive and lets go of them all."""
    held, stop = [], threading.Event()

    def open_some():
        while not stop.is_set() and len(held) < args.flood_count:
            try:
                # With a finished handshake a connection outlasts the 10-second handshake limit.
                held.append(connect(args, timeout=5) if args.flood_tls else
                            socket.create_connection(args.tls, timeout=3))
            except OSError:
                time.sleep(0.02)

    threads = [threading.Thread(target=open_some) for _ in range(16)]
    for thread in threads:
        thread.start()
    time.sleep(args.flood_seconds)
    stop.set()
    for thread in threads:
        thread.join()
    print(f"      flood: held {len(held)} sockets from one address", flush=True)
    for sock in held:
        sock.close()
    time.sleep(3)
    check("the front answers after the flood", clean_request(args, "/after-flood")[0] == 200)


def address(text):
    """HOST:PORT as a tuple."""
    host, port = text.rsplit(":", 1)
    return host, int(port)


def main():
    """Runs the attacks asked for."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--tls", type=address, required=True)
    parser.add_argument("--http", type=address, required=True)
    parser.add_argument("--slow", action="store_true")
    parser.add_argument("--flood", action="store_true")
    parser.add_argument("--big", action="store_true")
    parser.add_argument("--ws-idle", type=int, default=35)
    parser.add_argument("--flood-count", type=int, default=3000)
    parser.add_argument("--flood-seconds", type=int, default=30)
    parser.add_argument("--flood-only", action="store_true")
    parser.add_argument("--flood-tls", action="store_true")
    args = parser.parse_args()
    if args.flood_only:
        attack_flood(args)
        sys.exit(1 if failed else 0)
    attack_smuggling(args)
    attack_forged_forwarding(args)
    attack_forged_host(args)
    attack_oversized(args)
    attack_tls(args)
    attack_websocket_and_streaming(args)
    if args.slow:
        attack_slow_head(args)
        attack_slow_body(args)
        attack_idle(args)
    if args.big:
        attack_big_chunked(args)
    if args.flood:
        attack_flood(args)
    print(f"\n{len(failed)} failed" + (f": {failed}" if failed else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
