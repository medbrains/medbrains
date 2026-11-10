#!/usr/bin/env python3
"""Sends rogue IPv6 router advertisements onto a VM's virtual wire, as anyone on a LAN can, each with
a new prefix. The front must neither reissue its certificate nor restart.

  front-ra.py UDP_PORT SECONDS

The VM needs a NIC on `-netdev socket,udp=127.0.0.1:OTHER,localaddr=127.0.0.1:UDP_PORT`: QEMU carries a
whole Ethernet frame in each datagram. Never point this at a network you do not own.
"""
import socket, struct, sys, time

ROUTER_MAC = bytes.fromhex("02005e000bad")
ALL_NODES_MAC = bytes.fromhex("333300000001")
ROUTER_IP = bytes.fromhex("fe80000000000000" "0000" "5eff" "fe00" "0bad")
ALL_NODES_IP = bytes.fromhex("ff020000000000000000000000000001")
ICMPV6 = 58
ETHERTYPE_IPV6 = 0x86DD
MAX_HOPS = 255
INTERVAL_SECONDS = 5


def checksum(data):
    """The Internet checksum."""
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF


def advertisement(prefix_number):
    """A whole frame: a router advertisement offering 2001:db8:<number>::/64 for automatic addresses."""
    prefix = bytes.fromhex("20010db8") + struct.pack("!H", prefix_number) + bytes(10)
    option = struct.pack("!BBBBII", 3, 4, 64, 0xC0, 3600, 1800) + bytes(4) + prefix
    source = struct.pack("!BB", 1, 1) + ROUTER_MAC
    body = struct.pack("!BBHBBHII", 134, 0, 0, MAX_HOPS, 0, 1800, 0, 0) + source + option
    pseudo = ROUTER_IP + ALL_NODES_IP + struct.pack("!II", len(body), ICMPV6)
    body = body[:2] + struct.pack("!H", checksum(pseudo + body)) + body[4:]
    header = struct.pack("!IHBB", 0x60000000, len(body), ICMPV6, MAX_HOPS) + ROUTER_IP + ALL_NODES_IP
    return ALL_NODES_MAC + ROUTER_MAC + struct.pack("!H", ETHERTYPE_IPV6) + header + body


def main():
    """Sends a new prefix every few seconds."""
    port, seconds = int(sys.argv[1]), int(sys.argv[2])
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    started, number = time.time(), 1
    while time.time() - started < seconds:
        sock.sendto(advertisement(number), ("127.0.0.1", port))
        number += 1
        time.sleep(INTERVAL_SECONDS)
    print(f"sent {number - 1} prefixes")


if __name__ == "__main__":
    main()
