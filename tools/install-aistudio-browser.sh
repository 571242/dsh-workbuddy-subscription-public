#!/usr/bin/env bash
# 东京云端 AI Studio 无头浏览器：一次性安装脚本。
#
# 做的事：下载 chrome-headless-shell（aarch64）到 /opt/aistudio-browser，
# 校验共享库、设置属主。装完由插件设置页的「内置无头浏览器」开关拉起，
# 不需要常驻 systemd 服务——进程跟着 DSH 宿主走，DSH 重启它会自己重连。
#
# 幂等：重复执行只补缺，不重复下载。
set -euo pipefail

VERSION="${CHROME_VERSION:-156.0.8078.80}"
ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PLATFORM_ARCH="linux-arm64" ;;
  x86_64|amd64)  PLATFORM_ARCH="linux-x64" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

ROOT="/opt/aistudio-browser"
DIR="$ROOT/chrome-headless-shell-$PLATFORM_ARCH"
BIN="$DIR/chrome-headless-shell"
OWNER="${OWNER:-oracle-ai:oracle-ai}"

echo "==> target: $BIN ($PLATFORM_ARCH, chrome $VERSION)"

if [ ! -x "$BIN" ]; then
  mkdir -p "$ROOT"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  URL="https://storage.googleapis.com/chrome-for-testing-public/$VERSION/$PLATFORM_ARCH/chrome-headless-shell-$PLATFORM_ARCH.zip"
  echo "==> downloading $URL"
  curl -fsSL --retry 3 --retry-delay 2 -o "$TMP/chs.zip" "$URL"
  echo "==> unzipping"
  unzip -q -o "$TMP/chs.zip" -d "$ROOT"
  rm -rf "$TMP"
  trap - EXIT
else
  echo "==> already present, skipping download"
fi

chmod 0755 "$BIN"
chown -R "$OWNER" "$ROOT" 2>/dev/null || true

echo "==> shared library check"
MISSING="$(ldd "$BIN" 2>/dev/null | awk '/not found/{print $1}' || true)"
if [ -n "$MISSING" ]; then
  echo "!! missing libraries:" >&2
  echo "$MISSING" >&2
  echo "   install with: sudo apt-get install -y \$(for l in $MISSING; do echo -n \"\$l \"; done)" >&2
  exit 2
fi

echo "==> version"
"$BIN" --version

echo "==> smoke test (8s)"
PROFILE="$(mktemp -d)"
"$BIN" --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=0 --user-data-dir="$PROFILE" about:blank >/dev/null 2>&1 &
PID=$!
sleep 6
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  echo "==> OK"
else
  echo "!! browser died on startup" >&2
  exit 3
fi
rm -rf "$PROFILE"

echo
echo "Done. 打开 DSH 设置 → 自制渠道 → Google AI Studio → WebSocket 隧道，"
echo "把「走隧道」和「内置无头浏览器」都打开即可。"
