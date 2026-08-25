"""
Diagnoses whether the ~40-47s per-call latency seen on the Thor for Composio
search tools (search_local_events, search_local_places) is coming from the
Thor's network path to Composio/upstream APIs, or from those APIs themselves
genuinely taking that long to respond.

Measures three things per call:
  1. wall_clock  - time this script itself observed (network + upstream, total)
  2. dns_connect - raw TCP+TLS handshake time to backend.composio.dev, isolates
                   whether basic connectivity from this machine is already slow
  3. upstream_reported - the total_time_taken field SerpApi reports inside its
                   own response for SerpApi-backed tools (COMPOSIO_SEARCH_EVENT,
                   COMPOSIO_SEARCH_GOOGLE_MAPS) - this is SerpApi's own measured
                   processing time, independent of network latency to reach it.

If wall_clock is much bigger than upstream_reported, the gap is network/queueing
between this machine and Composio, not the search API itself. If they're close,
the API itself really is that slow from here, and the fix has to be architectural
(caching, timeouts, filler responses) rather than "something is misconfigured".

Usage (run this exact way on the Thor, same defensive pattern as
test_composio_search_tools.py - never touches the DB):
    cd knowledge_base_tool/backend
    python3 tests/test_composio_latency.py
"""

import asyncio
import socket
import ssl
import sys
import os
import time
from unittest.mock import MagicMock

sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extensions'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.tools.public_adapter import PublicToolsAdapter

COMPOSIO_HOST = "backend.composio.dev"

CASES = [
    ("COMPOSIO_SEARCH_EVENT", {"query": "cultural events", "location": "Indore", "htichips": "date:week"}),
    ("COMPOSIO_SEARCH_WEB", {"query": "cultural events in Indore this week 2026"}),
    ("COMPOSIO_SEARCH_GOOGLE_MAPS", {"q": "south indian restaurant Indore"}),
]


def measure_raw_connect(host: str, port: int = 443, timeout: float = 10.0) -> float:
    """Raw TCP+TLS handshake time to the Composio API host - isolates basic
    network reachability from anything the SDK or upstream API does."""
    t0 = time.monotonic()
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host):
            pass
    return time.monotonic() - t0


def extract_upstream_time(raw: dict) -> float | None:
    """Pull SerpApi's self-reported total_time_taken out of a raw Composio
    response, if present (only SerpApi-backed tools report this)."""
    if not isinstance(raw, dict):
        return None
    inner = raw.get("data", raw)
    if not isinstance(inner, dict):
        return None
    results = inner.get("results", {})
    if not isinstance(results, dict):
        return None
    meta = results.get("search_metadata", {})
    if isinstance(meta, dict):
        return meta.get("total_time_taken")
    return None


async def run_tests() -> None:
    print("=== Composio Latency Diagnosis (Thor) ===\n")

    print(f"1. Raw TCP+TLS handshake to {COMPOSIO_HOST}:443 ...")
    try:
        connect_time = measure_raw_connect(COMPOSIO_HOST)
        print(f"   {connect_time:.2f}s\n")
    except Exception as e:
        print(f"   FAILED: {type(e).__name__}: {e}\n")
        connect_time = None

    adapter = PublicToolsAdapter()

    for slug, args in CASES:
        print(f"--- {slug} ---")
        print(f"Arguments: {args}")
        t0 = time.monotonic()
        try:
            raw = await adapter._composio_search_raw(slug, args)
            wall_clock = time.monotonic() - t0
            upstream_reported = extract_upstream_time(raw)
            print(f"wall_clock (this machine, network+upstream): {wall_clock:.2f}s")
            if upstream_reported is not None:
                gap = wall_clock - upstream_reported
                print(f"upstream_reported (SerpApi's own total_time_taken): {upstream_reported:.2f}s")
                print(f"gap (network/queueing on top of SerpApi's own time): {gap:.2f}s")
                if gap > upstream_reported:
                    print("=> Gap exceeds SerpApi's own reported time: likely NETWORK PATH from this machine, not the API itself.")
                else:
                    print("=> Wall clock roughly matches SerpApi's own reported time: the API call itself is genuinely this slow from here.")
            else:
                print("upstream_reported: not available for this tool (no search_metadata.total_time_taken in response)")
        except Exception as e:
            wall_clock = time.monotonic() - t0
            print(f"wall_clock: {wall_clock:.2f}s (raised {type(e).__name__}: {e})")
        print()

    print("=== SUMMARY ===")
    if connect_time is not None:
        print(f"Raw TCP+TLS handshake baseline: {connect_time:.2f}s")
    print("Compare each case's wall_clock against its upstream_reported time above.")
    print("If handshake is fast (<1-2s) but wall_clock stays 40s+ with no upstream_reported")
    print("figure to compare against (COMPOSIO_SEARCH_WEB/Exa doesn't report one), the bottleneck")
    print("is most likely genuine upstream (SerpApi/Exa) processing time from this network,")
    print("not a Thor-side network fault - the only architectural fix left is caching, a request")
    print("timeout with a spoken filler response, or switching provider for this tool.")


if __name__ == "__main__":
    asyncio.run(run_tests())
