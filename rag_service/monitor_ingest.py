import argparse
import json
import os
import re
import sys
import time
from datetime import datetime


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ERR_LOG = os.path.join(BASE_DIR, "full_ingest.err.log")
DEFAULT_OUT_LOG = os.path.join(BASE_DIR, "full_ingest.out.log")
DEFAULT_CHECKPOINT = os.path.join(BASE_DIR, "nano_graphrag_cache", "ingest_checkpoint.json")
CHUNK_PATTERN = re.compile(r"chunk=(\d+)/(\d+)")


def safe_read_text(path: str) -> str:
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


def tail_lines(path: str, line_count: int) -> list[str]:
    text = safe_read_text(path)
    if not text:
        return []
    lines = text.splitlines()
    return lines[-line_count:]


def read_checkpoint(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def infer_latest_chunk(err_tail: list[str], out_tail: list[str]) -> tuple[int, int]:
    latest_current = -1
    latest_total = -1
    for line in err_tail + out_tail:
        match = CHUNK_PATTERN.search(line)
        if not match:
            continue
        cur = int(match.group(1))
        total = int(match.group(2))
        if cur > latest_current:
            latest_current = cur
            latest_total = total
    return latest_current, latest_total


def has_running_ingest() -> bool:
    # Simple heuristic: command line contains ingest.py
    # Works on Windows without external packages.
    cmd = "wmic process where \"CommandLine like '%ingest.py%'\" get ProcessId 2>nul"
    output = os.popen(cmd).read()
    return any(token.strip().isdigit() for token in output.split())


def render_screen(err_log: str, out_log: str, checkpoint_file: str, tail_count: int):
    checkpoint = read_checkpoint(checkpoint_file)
    err_tail = tail_lines(err_log, tail_count)
    out_tail = tail_lines(out_log, tail_count)
    latest_cur, latest_total = infer_latest_chunk(err_tail, out_tail)

    processed = int(checkpoint.get("processed_chunks") or 0)
    total = int(checkpoint.get("total_chunks") or 0)
    status = str(checkpoint.get("status") or "unknown")

    percent = 0.0
    if total > 0:
        percent = (processed / total) * 100.0

    os.system("cls" if os.name == "nt" else "clear")
    print("=== Full Ingest Monitor ===")
    print(f"time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"ingest process running: {has_running_ingest()}")
    print(f"checkpoint status: {status}")
    print(f"checkpoint progress: {processed}/{total} ({percent:.2f}%)")

    if latest_cur > 0 and latest_total > 0:
        print(f"latest chunk in logs: {latest_cur}/{latest_total}")
    else:
        print("latest chunk in logs: n/a")

    print("\n--- ERR LOG TAIL ---")
    if err_tail:
        for line in err_tail:
            print(line)
    else:
        print("(no lines)")

    print("\n--- OUT LOG TAIL ---")
    if out_tail:
        for line in out_tail:
            print(line)
    else:
        print("(no lines)")


def main():
    parser = argparse.ArgumentParser(description="Live monitor for full GraphRAG ingestion")
    parser.add_argument("--err-log", default=DEFAULT_ERR_LOG)
    parser.add_argument("--out-log", default=DEFAULT_OUT_LOG)
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT)
    parser.add_argument("--interval", type=float, default=2.0, help="refresh interval in seconds")
    parser.add_argument("--tail", type=int, default=12, help="tail lines per log")
    args = parser.parse_args()

    try:
        while True:
            render_screen(args.err_log, args.out_log, args.checkpoint, args.tail)
            time.sleep(max(0.5, args.interval))
    except KeyboardInterrupt:
        print("\nmonitor stopped")
        sys.exit(0)


if __name__ == "__main__":
    main()
