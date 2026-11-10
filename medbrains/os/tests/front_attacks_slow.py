"""The attacks that take a long time or a lot of connections, for `front-attacks.py`."""
import socket, ssl, threading, time

from front_lib import HOST, check, clean_request, connect, context, read_all


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


def attack_slow_reader(args):
    """A client that asks for a large response and stops reading loses it."""
    raw = socket.socket()
    raw.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4096)
    raw.settimeout(8)
    raw.connect(args.tls)
    with context().wrap_socket(raw, server_hostname="medbrains.local") as sock:
        sock.sendall(f"GET /__big HTTP/1.1\r\n{HOST}Connection: close\r\n\r\n".encode())
        started = time.time()
        time.sleep(150)
        total, closed = 0, False
        sock.settimeout(3)
        try:
            while True:
                chunk = sock.recv(1 << 20)
                if not chunk:
                    closed = True
                    break
                total += len(chunk)
        except OSError as error:
            closed = "timed out" not in str(error)
    whole = 64 * 1024 * 4096
    check(f"a stalled reader is cut off (got {total >> 20} of {whole >> 20} MiB, {round(time.time() - started)} s)",
          closed and total < whole, (closed, total))


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


def attack_websocket_is_no_upload(args):
    """Traffic on an open WebSocket does not count toward the upload limit."""
    with connect(args, timeout=30) as sock:
        sock.sendall(f"GET /__ws HTTP/1.1\r\n{HOST}Connection: Upgrade\r\nUpgrade: websocket\r\n"
                     "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        head, _ = read_all(sock, 3)
        mib = b"x" * (1024 * 1024)
        echoed, failed = 0, None
        sock.settimeout(30)
        try:
            for _ in range(260):
                sock.sendall(mib)
                need = echoed + len(mib)
                while echoed < need:
                    echoed += len(sock.recv(1 << 20))
        except OSError as error:
            failed = repr(error)
    check(f"a WebSocket carries past the upload limit ({echoed >> 20} MiB)",
          head.startswith(b"HTTP/1.1 101") and echoed >= 260 << 20, failed)


def attack_flood(args):
    """Thousands of held connections on every port: the front stays alive and lets go of them all."""
    held, plain, stop = [], [], threading.Event()
    # Nearly a whole head on each: the most memory one TLS connection can make the front hold.
    partial = f"GET / HTTP/1.1\r\n{HOST}X-Pad: {'a' * args.flood_head}".encode()

    def open_tls():
        while not stop.is_set() and len(held) < args.flood_count:
            try:
                if not args.flood_tls:
                    held.append(socket.create_connection(args.tls, timeout=3))
                    continue
                # With a finished handshake a connection outlasts the 10-second handshake limit.
                sock = connect(args, timeout=5)
                if args.flood_head:
                    sock.sendall(partial)
                held.append(sock)
            except OSError:
                time.sleep(0.02)

    def open_plain():
        while not stop.is_set() and len(plain) < args.flood_plain:
            try:
                plain.append(socket.create_connection(args.http, timeout=3))
            except OSError:
                time.sleep(0.02)

    threads = [threading.Thread(target=open_tls) for _ in range(16)]
    threads += [threading.Thread(target=open_plain) for _ in range(2)]
    for thread in threads:
        thread.start()
    time.sleep(args.flood_seconds)
    stop.set()
    for thread in threads:
        thread.join()
    print(f"      flood: held {len(held)} TLS and {len(plain)} plain sockets", flush=True)
    for sock in held + plain:
        sock.close()
    time.sleep(3)
    check("the front answers after the flood", clean_request(args, "/after-flood")[0] == 200)
