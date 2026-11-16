#!/usr/bin/env python3
"""把 dsh-workbuddy-subscription 调整成可与上游 @eddyskywalker/dsh-chatgpt-subscription 共存。

背景
----
两个包是同一份代码的两代，功能高度重叠。同时启用时有三处会撞：

1. HTTP 路由前缀（致命）—— 两边都注册 `kind: "prefix"` 的同名路径，
   dsh 的 webServer 遇到重复直接抛 `duplicate prefix route`，插件激活中断，
   因为它是 required 插件，整个 boot 失败。
2. provider 路由（声明式抢占）—— 两边注册同名 providerId（antigravity、claude、
   kimi-code 等）。`llm.registerAdapter` 先到先得，后到者只 warn 并让出。
3. 前端设置界面 —— 各自由 client.js 注入，不做处理。

本脚本做两件事
--------------
A. 把所有 HTTP 路由迁到 `/wb` 命名空间（服务端 + 前端同步），消除致命冲突。
B. 给 `claimProviderRoute` 加独占白名单：重叠 provider 不再抢占，交给上游新版服务；
   本插件只保留自己独有的 `workbuddy-subscription` 与 `google-vertex-*`。

白名单可通过 cordis.patch.yml 的 `config.exclusiveProviderRoutes: false` 关闭，
恢复"全部抢占"的旧行为。

幂等
----
先还原已加的命名空间再重新施加，重复执行结果不变。

用法
----
    python tools/rebase-local.py --dry-run   # 只看将改哪里
    python tools/rebase-local.py             # 实际写入
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = "/wb"

# 与上游完全重叠的前缀（顺序无关，替换互不包含）
OVERLAPPING_PREFIXES = [
    "/api/dsh-chatgpt-subscription",
    "/command-code/api",
    "/ollama/api",
    "/kimi-code/api",
    "/workbuddy/api",
    "/claude/api",
    "/glm-coding-plan/api",
    "/step-code/api",
    "/minimax-code/api",
    "/antigravity/api",
]

MARKER = "LOCAL_EXCLUSIVE_PROVIDER_ROUTES"
ALLOWLIST = ["codex-chatgpt", "antigravity", "workbuddy-subscription", "google-vertex-gemini", "google-vertex-anthropic", "google-ai-studio"]

CLAIM_ANCHOR = "function claimProviderRoute(ctx, options) {\n"
APPLY_ANCHOR = "function apply(ctx, pluginConfig = {}) {\n"


def migrate_route_text(text: str, prefix: str, ns: str) -> tuple[str, int]:
    """把 prefix 迁移进 ns 命名空间；先还原再施加，保证幂等。"""
    escaped = prefix.replace("/", "\\/")            # 正则字面量里的形态 \/claude\/api
    ns_plain = ns + prefix                          # /wb/claude/api
    ns_escaped = ns.replace("/", "\\/") + escaped   # \/wb\/claude\/api

    original = text

    # 1) 还原：去掉已经加过的命名空间
    text = text.replace(ns_plain, prefix)
    text = text.replace(ns_escaped, escaped)

    # 2) 施加：两种写法各自加前缀
    text = text.replace(prefix, ns_plain)
    text = text.replace(escaped, ns_escaped)

    return text, sum(original.count(p) for p in (prefix, escaped))


def patch_routes(path: Path, dry_run: bool) -> list[str]:
    text = path.read_text(encoding="utf-8")
    lines = []

    for prefix in OVERLAPPING_PREFIXES:
        text, hits = migrate_route_text(text, prefix, NS)
        lines.append(f"  {prefix:34} -> {NS + prefix:37} ({hits} 处)")

    if not dry_run:
        path.write_text(text, encoding="utf-8")
    return lines


def patch_claim_allowlist(path: Path, dry_run: bool) -> str:
    text = path.read_text(encoding="utf-8")

    if MARKER in text:
        return "  已存在白名单，跳过（幂等）"

    if CLAIM_ANCHOR not in text:
        raise SystemExit("找不到 claimProviderRoute 定义，请检查 lib/index.js 结构")

    allowlist_js = ", ".join(f'"{item}"' for item in ALLOWLIST)
    injected = (
        "// [wb-local] 共存隔离：与上游插件重叠的 provider 一律让给上游，只保留本插件独有的渠道。\n"
        f"const {MARKER} = /* @__PURE__ */ new Set([{allowlist_js}]);\n"
        "let localExclusiveProviderRoutes = true;\n"
        "function claimProviderRoute(ctx, options) {\n"
        "\tif (localExclusiveProviderRoutes && !" + MARKER + ".has(options.providerId)) {\n"
        "\t\tctx.logger.info(`[dsh-workbuddy] provider \"${options.providerId}\" 由上游插件服务，本插件不抢占（路由仍保留供设置页查询）`);\n"
        "\t\treturn { serving: () => false, conflict: () => null, dispose: () => {} };\n"
        "\t}\n"
    )
    text = text.replace(CLAIM_ANCHOR, injected, 1)

    if APPLY_ANCHOR not in text:
        raise SystemExit("找不到 apply 定义，请检查 lib/index.js 结构")
    text = text.replace(
        APPLY_ANCHOR,
        APPLY_ANCHOR + "\tlocalExclusiveProviderRoutes = pluginConfig?.exclusiveProviderRoutes !== false;\n",
        1,
    )

    if not dry_run:
        path.write_text(text, encoding="utf-8")
    return "  已注入独占白名单（workbuddy-subscription + google-vertex-*）"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只报告，不写文件")
    args = parser.parse_args()

    targets = [ROOT / "lib" / "index.js", ROOT / "lib" / "client.js"]
    for target in targets:
        if not target.exists():
            raise SystemExit(f"缺少文件：{target}")

    print(f"{'[预演]' if args.dry_run else '[写入]'} 工作目录 {ROOT}\n")

    for target in targets:
        print(f"路由迁移 {target.relative_to(ROOT)}")
        for line in patch_routes(target, args.dry_run):
            print(line)
        print()

    print("provider 独占白名单 lib/index.js")
    print(patch_claim_allowlist(ROOT / "lib" / "index.js", args.dry_run))
    print()

    print("完成。" + ("（未写入，去掉 --dry-run 生效）" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
