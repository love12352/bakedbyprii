#!/usr/bin/env python3
"""
Benchmark: server.py (threaded + gzip + caching) vs plain `python -m http.server`.

Usage (start both servers first):
    python -m http.server 8000 --directory separated      # baseline
    python server.py --port 8001                           # ours

    python bench.py --baseline http://127.0.0.1:8000 --ours http://127.0.0.1:8001
"""

from __future__ import annotations

import argparse
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PATHS = ["/index.html", "/styles.css", "/script.js"]   # paths both servers share


def fetch(url: str):
    """Return (latency_seconds, wire_bytes, encoding) for one GET request."""
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read()
        enc = r.headers.get("Content-Encoding", "identity")
    return time.perf_counter() - t0, len(body), enc


def run(base: str, requests: int, concurrency: int):
    urls = [base + PATHS[i % len(PATHS)] for i in range(requests)]
    latencies, wire_total, gzip_hits = [], 0, 0

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for lat, size, enc in pool.map(fetch, urls):
            latencies.append(lat * 1000)  # ms
            wire_total += size
            gzip_hits += (enc == "gzip")
    wall = time.perf_counter() - t0

    latencies.sort()
    return {
        "requests": requests,
        "wall_s": wall,
        "rps": requests / wall,
        "mean_ms": statistics.mean(latencies),
        "p50_ms": latencies[len(latencies) // 2],
        "p95_ms": latencies[int(len(latencies) * 0.95) - 1],
        "max_ms": latencies[-1],
        "wire_kb": wire_total / 1024,
        "gzip_pct": 100 * gzip_hits / requests,
    }


def show(name: str, s: dict):
    print(f"\n=== {name} ===")
    print(f"  requests/sec : {s['rps']:8.1f}")
    print(f"  mean latency : {s['mean_ms']:8.2f} ms")
    print(f"  p50 / p95    : {s['p50_ms']:.2f} / {s['p95_ms']:.2f} ms")
    print(f"  max latency  : {s['max_ms']:8.2f} ms")
    print(f"  bytes on wire: {s['wire_kb']:8.1f} KB")
    print(f"  gzip served  : {s['gzip_pct']:8.0f} %")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True, help="plain http.server base URL")
    ap.add_argument("--ours", required=True, help="server.py base URL")
    ap.add_argument("--requests", type=int, default=600)
    ap.add_argument("--concurrency", type=int, default=20)
    args = ap.parse_args()

    print(f"Benchmark: {args.requests} requests @ concurrency {args.concurrency}")

    # warm up
    for base in (args.baseline, args.ours):
        try:
            fetch(base + PATHS[0])
        except Exception as e:
            raise SystemExit(f"Cannot reach {base}: {e}")

    base = run(args.baseline, args.requests, args.concurrency)
    ours = run(args.ours, args.requests, args.concurrency)

    show("Baseline  (python -m http.server)", base)
    show("Ours      (server.py)", ours)

    print("\n=== Comparison ===")
    print(f"  throughput : {ours['rps'] / base['rps']:.2f}x")
    print(f"  p95 latency: {base['p95_ms'] / ours['p95_ms']:.2f}x faster")
    print(f"  bytes sent : {100 * (1 - ours['wire_kb'] / base['wire_kb']):.0f}% smaller (gzip)")


if __name__ == "__main__":
    main()
