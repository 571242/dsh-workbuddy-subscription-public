# 自制渠道 (dsh-workbuddy-subscription v1.4.0-local.1)

## Antigravity 登录配置

启动 DSH 时设置 `DSH_ANTIGRAVITY_CLIENT_ID` 和 `DSH_ANTIGRAVITY_CLIENT_SECRET` 环境变量，插件会使用对应的 OAuth 客户端信息。

## 1.4.0-local.1 Antigravity 深度重构（参考 `dsh-agy-link` v0.6.18 与官方 `2.29.0` 协议栈，2026-11-11）

- **根因彻底清除（解决满额度恒报 `429 RESOURCE_EXHAUSTED`）**：Google Cloud Code 对推理信封 `systemInstruction.parts[0].text` 启用了严格字面校验，旧版改写句与 `[ignore]…[/ignore]` 指纹会被静默返回无重置时间的伪 `429`。现对齐官方两句原文、移除全部自造提示词残片、`requestId` 改为 `agent-<uuid>`、默认项目改为 `rising-fact-p41fc`。
- **出站传输与控制面隔离**：默认仅发送 4 个纯净头（`Authorization` / `Content-Type` / `Accept` / `User-Agent`），内置版本基线升至 `2.29.0` (`cl=1013060670`) 并后台 6h TTL 单飞跟随官方 Hub 清单；`onboardUser` 独立走控制面头与蛇形 metadata；Antigravity 独享每凭据隔离的 HTTP/1.1 连接池，剥离 `sec-fetch-mode` / `accept-language` 浏览器头、直连省略 ALPN、Windows 注册表代理检测加 `windowsHide` 零闪窗。
- **融合 `dsh-agy-link` 号池与多桶配额体系**：
  - **三配额族独立追踪**：将 `gemini-4-argon` 拆为独立的 `argon` 配额族，与 `gemini`、`claude-gpt` 完全解耦冷却；
  - **到期优先调度 (`expiry-first`) 与配额见底预检避让**：支持优先消耗最快重置的 7d/5h 窗口，剩余 ≤1% 自动避让健康号；
  - **智能 429 分级与临近重置微等**：无重置时间的瞬时 429 仅避让 5 秒（不再锁死唯一账号 15 分钟）；重置时间 ≤15 秒且单账号时原地微等自动重放；
  - **单账号独立代理 (`proxyUrl`) 与本机 `agy` CLI 凭据一键导入**：支持每个 Google 账号绑定独立 HTTP/SOCKS5 代理防关联，并支持从 `~/.gemini/antigravity-cli` 或系统凭据管理器导入 `agy` 登录态；
  - **退役模型自动清洗**：从选择器移除上游已下线的 `gemini-3.7/3.6/3.5-flash`，旧会话残留 ID 自动平滑路由至 `gemini-3.8-flash-tiered`；生图工具新增 `imageSize` (`0.5K`–`4K`) 与扩展宽高比。

## Antigravity 账号停用错误修复（2026-11-06）

- 收到 Google 明确的 `403 TOS_VIOLATION` 时，显示账号停用原因和 Google 返回的申诉地址，不再以空配额冒充刷新成功。普通 403 和 429 保持独立处理。
- 对话、图像、登录及额度请求不再对 401/403/429 重试另一个端点；429 保留原有账号冷却与切换，5xx 仍可回退。
- 账号被停用时停止自动额度查询，手动刷新或切换账号后可重新检查；账号切换时，旧请求不能覆盖新账号的状态。
- 这项修复不能恢复 Google 已停用的账号服务；请使用 Google 返回的申诉入口处理。手动再次发起模型或图像请求仍会向服务端请求。
- 本机安装副本保留 Codex 原有本机保护，未合入工作区中的额外后台凭据刷新器。更新已运行的宿主需完整退出并重启 DSH。

## 1.3.1-local.2 续期调度

取消凭证每分钟轮询。启动核对一次后，按账号最早到期时间设置一次性唤醒，在到期前五分钟续期；新增账号或凭证变化后重排定时器。临时失败延后十五分钟重试，同时不耽误其他账号的到期时间；保留请求前续期兜底。

## 1.3.1-local.1 修复

- ChatGPT 账号池使用「工作区 + 成员身份」去重；同一 Team 工作区的不同成员不再互相覆盖，同一成员重新登录仍更新原账号。
- 输入框下方的 Codex 剩余量支持点击与键盘刷新，显示刷新状态；刷新失败保留最近成功数值并提供重试提示。
- 插件管理的 ChatGPT 凭证除原有请求前续期外，增加后台临期续期；借用的 Codex CLI 登录快照仍由 CLI 自己续期，避免两个进程争用轮换凭证。
- 此前已被覆盖的账号需要重新添加；更新不迁移、不清空现有加密账号池。

专属精简版 DSH 四合一渠道管理插件（设置页入口：**设置 → 自制渠道**），包名保持 `dsh-workbuddy-subscription` 以实现现有配置与加密凭据 100% 零迁移无缝兼容。

## 1. 集成的五大渠道与 Provider 路由

概览页（`设置 → 自制渠道`）保留以下 5 个核心渠道卡片，每个渠道均支持**独立开关**、**账号池/凭证管理**、**自行获取/手动刷新模型目录**与**测试连接**：

| 渠道卡片 | Provider ID | 认证方式与加密凭据存储（直接复用，无需搬迁） | 自行获取更新模型（动态目录） |
| --- | --- | --- | --- |
| **ChatGPT** | `codex-chatgpt` | 浏览器 OAuth / 导入本机 Codex CLI 登录（`storages/codex-pool.json.dpapi`、`storages/dsh-chatgpt-subscription/oauth.dpapi`） | 自动拉取 `GET /backend-api/codex/models` + 设置页「连接」区块右上角 **「刷新模型目录」** 按钮强制同步新模型 |
| **Antigravity** | `antigravity` | Google OAuth 账号池（`storages/antigravity-pool.json.dpapi`、`storages/antigravity-oauth.json.dpapi`） | 自动调用 `v1internal:fetchAvailableModels` 发现模型及真实上下文上限 + 设置页「模型」区块右上角 **「刷新模型目录」** 按钮 |
| **WorkBuddy 订阅** | `workbuddy-subscription` | 浏览器授权（国区/国际区）或只读复用桌面端 CodeBuddy（`storages/workbuddy-pool.json.dpapi`、`storages/workbuddy-accounts.json.dpapi`） | 自动拉取 `/v3/config` + 设置页「模型」区块右上角 **「刷新模型目录」** 按钮 |
| **Vertex AI 服务账号** | `google-vertex-gemini`、`google-vertex-anthropic` | 导入 Google Cloud `service_account` JSON 文件（`storages/workbuddy-vertex.dpapi`） | 自动调用 Vertex Model Garden `v1beta1/publishers/google/models` + 设置页操作区 **「刷新模型目录」** 按钮清除 5 分钟缓存并即时拉取 |
| **Google AI Studio** | `google-ai-studio` | 粘贴 Google AI Studio API Key（多 Key 账号池，`storages/workbuddy-aistudio.dpapi`） | 自动调用官方 `GET /v1beta/models` 拉取 Gemini 对话模型及真实上下文/输出上限 + 设置页「模型」区块 **「刷新模型目录」** 按钮 |

### Google AI Studio 渠道说明

- **多 Key 账号池**：每行一个 API Key（支持「备注=AIza...」批量粘贴），提供顺序耗尽 / 轮询调度 / 粘性会话三种调度策略。
- **429 自动换号**：遇到 `429` 或 `RESOURCE_EXHAUSTED` 时按 1 分钟起、翻倍至 30 分钟封顶的指数退避冷却该 Key，并当场切换池内下一个可用 Key 重试，对话不中断；`401/403` 直接标记该 Key 失效。
- **自定义网关**：接口地址默认官方 `https://generativelanguage.googleapis.com`，也可填 Gemini Balance、New-API 等反代网关根地址。
- **协议复用**：请求体构造、SSE 翻译、Gemini 3 `thoughtSignature` 回放与尾轮修正全部复用 `vendor/vertex/lib/gemini.js`，与 Vertex 路由同源，避免两份实现漂移。
- **凭据安全**：整份账号池经系统加密存储（Windows DPAPI / macOS Keychain / Linux Secret Service），设置页只回传掩码（`AIza…ABCD`），任何错误信息都会拦截明文 Key。

#### WebSocket 隧道（浏览器反代）

设置页「WebSocket 隧道」区块把出网这一步交给浏览器页面：DSH 不再由 Node 直接请求 Google，而是把请求打包成 `http_request` 帧，经 `/wb/aistudio/ws` 交给页面里的 `fetch()` 执行，状态码、响应头、响应体分片沿同一条 WebSocket 回流。

**为什么需要它**：从非 Google 网络的服务器直连时，`generativelanguage.googleapis.com` 会因出口 IP、TLS 指纹或 CORS 前置条件拒绝；由浏览器页面发起则天然带上页面 Origin、Cookie 与浏览器网络栈。

| 开关 | 作用 |
| --- | --- |
| **走隧道** | 打开后请求优先走隧道；没有浏览器连接时自动回落直连，不会把对话卡死。首次打开自动生成 32 字节随机令牌。 |
| **内置无头浏览器** | 由插件自己在这台机器上养一个 `chrome-headless-shell`，24 小时跟随 DSH 运行。本地用已装的 Edge/Chrome，云端自动下载到 `/opt/aistudio-browser`（约 120MB）。 |
| **接入地址** | 形如 `ws://127.0.0.1:<端口>/wb/aistudio/ws?token=...`。外部浏览器脚本可拿它接入；令牌可一键重置。 |
| **测试隧道** | 经隧道真实取一次模型目录，验证页面上下文确实通。 |
| **打开登录窗口** | 需要 Google 登录态时用：弹出有头窗口完成登录，关掉即回到无头，登录态留在插件自己的 profile。 |

云端服务器（无桌面）安装无头浏览器：

```bash
sudo bash tools/install-aistudio-browser.sh
```

然后用设置页的两个开关打开即可，无需手写脚本、无需 systemd 常驻服务（浏览器进程跟着 DSH 宿主走，宿主重启会自动重连）。

帧协议（JSON 文本帧，与 CLIProxyAPI 的 `wsrelay` 同构，便于抓包对照）：

```
browser → host   hello          {name, version, href, ua}
host → browser   http_request   {id, method, url, headers, body}
browser → host   stream_start   {id, status, headers}
browser → host   stream_chunk   {id, data(base64)}
browser → host   stream_end     {id}
browser → host   error          {id, error}
host → browser   cancel_request {id}
both             ping / pong
```

隧道不引入 `ws` 依赖：RFC 6455 的服务端编解码（客户端掩码、分片、控制帧）在 `lib/aistudio-tunnel.js` 内自带实现。握手校验令牌（常量时间比较）与 `Origin`（只放行 `*.aistudio.google.com` 与本机回环）。

---

## 2. 从 `@eddyskywalker/dsh-chatgpt-subscription` (0.45.0 → 0.52.0) 精选吸收的更新

排查上游 `0.45.0 → 0.52.0` 的全部更新后，剔除了导致你每次更新报错的罪魁祸首（`0.48.0` 强插 4 个全局宿主缓存守卫吞掉 Cordis 瀑布 `next()` 导致每轮崩溃、`tools.register` 绑死根作用域报错、多入口子路径拆分冲突及 9 条无关冗余渠道），仅将对这 4 个渠道真正有益的更新移植到了本插件：

1. **通用工具调用 ID 提取修复（`0.48.4` `src/host/common/llm-compat.ts`）**：修复 `normalizeMessages` 在 `role: 'tool'` 消息将 `toolCallId` 放在内嵌 `tool-result` 块中时读出空串，导致网关报 `11148 tool calls and tool results do not match` 以及伪造孤儿占位符的严重 Bug。
2. **ChatGPT (Codex) 渠道更新**：
   - **`0.45.0` 模型目录补齐**：内置兜底目录新增 `gpt-6.1-terra`（`6.1 Terra`，384K 默认上下文 / 最高 872K，128K 输出上限）并默认可见。
   - **`0.46.1` TLS 握手/连接前失败自动重试**：`ResponsesClient` 对请求尚未到达服务端前的连接失败（TLS 握手前断开、`UND_ERR_CONNECT_TIMEOUT`、`ECONNREFUSED`、`ENOTFOUND`/`EAI_AGAIN`）自动重试最多 2 次（400ms / 800ms 退避），避免代理抖动直接废掉整轮对话。
3. **Antigravity 渠道更新**：
   - **`0.40.2` 流式中途断线归类为可重试 `TRANSPORT`**：响应流读取中途断线（undici `TypeError: terminated`）不再变成不可重试的 `UNKNOWN`，而是保留完整 cause 链并标记为 `TRANSPORT` 交由 DSH 自动重试。
4. **WorkBuddy 订阅渠道更新**：
   - **`0.47.0` 桌面端身份升级**：出站桌面端 User-Agent 升级至 `WorkBuddy/5.9.3` / `CLI/2.165.0`，对齐最新上游网关校验。
   - **`0.48.3` 本地额度护栏白屏修复**：修复连续输入「保留积分 / 账号日 token / 模型日 token」时异步读取已销毁 `event.currentTarget` 导致设置页崩溃白屏的问题。
5. **网络代理管理器升级（`0.37.0` & `0.44.0` `ProxyManager`）**：
   - 代理连接池遇到 `ClientDestroyedError`（`terminated: The client is destroyed`）时自动摘除死连接并换新连接重试一次；卸载时改为 `close()` 优雅等待在途流完成。
   - 自动旁路本机回环地址（`127.0.0.0/8`、`localhost`、`::1`）并支持读取 `NO_PROXY`；代理握手超时放宽至 60s。

---

## 3. 共存与独立运行模式

- **所有 HTTP 设置路由均隔离在 `/wb` 命名空间下**（`/wb/api/dsh-chatgpt-subscription`、`/wb/antigravity/api`、`/wb/workbuddy/api`、`/wb/workbuddy/vertex/api`），绝不与任何其他插件撞路由。
- **Provider 路由白名单**：`LOCAL_EXCLUSIVE_PROVIDER_ROUTES` 现包含全部 4 个渠道（`codex-chatgpt`、`antigravity`、`workbuddy-subscription`、`google-vertex-gemini`、`google-vertex-anthropic`）。
  - 当你卸载或禁用上游 `@eddyskywalker/dsh-chatgpt-subscription` 后，本插件会自动接管全部 4 个渠道的对话流量与模型列表。
  - 若两者同时启用，先注册者持有 `codex-chatgpt` 与 `antigravity`，后注册者自动让出并记录日志，不会导致 Host 启动失败。

## 4. 维护与打包命令

```bash
python tools/rebase-local.py
node --check lib/index.js && node --check lib/client.js
node --test test/*.test.mjs
npm pack
```
