"""What the front's attack tests share: connections to the front, and what the recorder saw."""
import socket, ssl, time

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
