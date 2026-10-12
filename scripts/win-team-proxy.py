#!/usr/bin/env python3
"""Windows-side TCP forwarder: LAN :3916 -> WSL team server on localhost (internal port)."""

from __future__ import annotations

import argparse
import socket
import sys
import threading


def relay(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            chunk = src.recv(65536)
            if not chunk:
                break
            dst.sendall(chunk)
    except OSError:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle(client: socket.socket, target_host: str, target_port: int) -> None:
    try:
        upstream = socket.create_connection((target_host, target_port), timeout=30)
    except OSError:
        client.close()
        return
    threading.Thread(target=relay, args=(client, upstream), daemon=True).start()
    threading.Thread(target=relay, args=(upstream, client), daemon=True).start()


def main() -> int:
    parser = argparse.ArgumentParser(description="Forward team server port from Windows LAN to WSL.")
    parser.add_argument("--listen-host", default="0.0.0.0")
    parser.add_argument("--listen-port", type=int, default=3916)
    parser.add_argument("--target-host", default="127.0.0.1")
    parser.add_argument("--target-port", type=int, default=3917)
    args = parser.parse_args()

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind((args.listen_host, args.listen_port))
    except OSError as exc:
        print(
            f"ERROR: Cannot bind {args.listen_host}:{args.listen_port} ({exc}). "
            "Stop any other team server on 3916.",
            file=sys.stderr,
        )
        return 1
    server.listen(128)
    print(
        f"Team proxy {args.listen_host}:{args.listen_port} -> "
        f"{args.target_host}:{args.target_port}",
        flush=True,
    )
    while True:
        client, _addr = server.accept()
        threading.Thread(
            target=handle,
            args=(client, args.target_host, args.target_port),
            daemon=True,
        ).start()


if __name__ == "__main__":
    raise SystemExit(main())
