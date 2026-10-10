#!/usr/bin/env python3
"""证据校验：检查 inspector schema 完整性、截图存在性、色彩熵阈值。"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IDX = os.path.join(ROOT, "artifacts", "evidence.json")
MIN_ENTROPY = 3.0

def main() -> int:
    with open(IDX, encoding="utf-8") as f:
        idx = json.load(f)
    fails = []
    for cap in idx["captures"]:
        rp = os.path.join(ROOT, cap["report"])
        try:
            with open(rp, encoding="utf-8") as f:
                r = json.load(f)
        except OSError:
            fails.append(f"{cap['state']}: 报告缺失 {cap['report']}")
            continue
        for key in ("runId", "mode", "state", "requestedState", "appliedState",
                    "screenshotPath", "consoleErrors", "pageErrors", "result"):
            if key not in r:
                fails.append(f"{cap['state']}: 缺字段 {key}")
        shot = os.path.join(ROOT, r.get("screenshotPath", ""))
        if not os.path.isfile(shot) or os.path.getsize(shot) < 10_000:
            fails.append(f"{cap['state']}: 截图缺失或过小 {shot}")
        if r.get("pageErrors"):
            fails.append(f"{cap['state']}: 存在页面错误 {r['pageErrors'][:2]}")
        ent = r.get("result", {}).get("metrics", {}).get("colorEntropyBits", 0)
        if ent < MIN_ENTROPY:
            fails.append(f"{cap['state']}: 色彩熵 {ent} < {MIN_ENTROPY}")
        else:
            print(f"PASS {cap['mode']}/{cap['state']} entropy={ent}")
    if fails:
        print("\n== FAIL ==")
        for x in fails:
            print(" -", x)
        return 1
    print(f"\n全部 {len(idx['captures'])} 项证据通过校验")
    return 0

if __name__ == "__main__":
    sys.exit(main())
