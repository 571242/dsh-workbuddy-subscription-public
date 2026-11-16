window.__ModuleLoader__.load({
	id: "dsh-workbuddy-subscription",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared/minimax-code-contracts.ts
		/**
		* 全线共用的思考档位，按从小到大的顺序排列。
		*
		* 设置卡片只渲染这一份列表：档位是线路级的词汇表（`isMinimaxCodeReasoningEffort`
		* 就是按它校验的），而不是单个模型的能力表。某个模型实际接受哪些档位由
		* `MinimaxCodeModelOption.reasoningEfforts` 单独给出——把两者合成一份会让卡片
		* 在给一个只认 `default` 的模型显示 `max` 时无从判断是模型不支持还是文案没写。
		*/
		const MINIMAX_CODE_REASONING_EFFORTS = [
			"default",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/**
		* 路由前缀（host 暴露、client 消费）。
		*
		* 与其余各订阅线路一致：每条线路把自己的设置面挂在 `/<line>/api` 下
		* （antigravity / claude / command-code / kimi-code / workbuddy 都是如此），
		* 而不是挂到 Codex 那条线路的 `/wb/api/dsh-chatgpt-subscription` 前缀下面。
		* 唯一的 `/wb/api/dsh-chatgpt-subscription` 前缀属于 Codex 自己的路由表。
		*/
		const MINIMAX_CODE_ROUTE_PREFIX = "/wb/minimax-code/api";
		const ROUTE_PREFIX = "/wb/api/dsh-chatgpt-subscription";
		const CODEX_CHATGPT_PROVIDER_ID = "codex-chatgpt";
		const CODEX_IMAGE_TOOL_NAME = "codex_image_generate";
		/**
		* The Antigravity image tool and the runtime it calls.
		*
		* `gemini-3.1-flash-image` is listed by `fetchAvailableModels`, but its product
		* is an image and the harness accepts text-only assistant output, so it is
		* served as a tool (like Codex images) rather than as a chat model.
		*/
		const ANTIGRAVITY_IMAGE_TOOL_NAME = "antigravity_image_generate";
		//#endregion
		//#region src/client/common/use-store.ts
		/**
		* Subscribe to a snapshot store as a React value.
		*
		* Two copies of this existed — the shared composer badge and the ChatGPT badge —
		* which is why it lives in its own module rather than being exported from the
		* badge: a component module exporting a generic hook reads as if the hook
		* belonged to that component.
		*/
		function useStore(store) {
			return (0, react.useSyncExternalStore)((listener) => store.subscribe(listener), () => store.getSnapshot(), () => store.getSnapshot());
		}
		//#endregion
		//#region src/client/quota.ts
		function selectQuotaForModel(quota, modelId) {
			if (quota === void 0 || quota.buckets.length === 0) return null;
			const bucket = (modelId?.toLowerCase() ?? "").includes("spark") ? quota.buckets.find((candidate) => `${candidate.id} ${candidate.name}`.toLowerCase().includes("spark")) : quota.buckets.find((candidate) => candidate.id === "codex") ?? quota.buckets.find((candidate) => candidate.name.toLowerCase() === "codex");
			if (bucket === void 0) return null;
			const windows = quotaWindows(bucket);
			if (windows.length === 0) return null;
			const window = [...windows].sort((a, b) => {
				return (a.windowDurationMins ?? Infinity) - (b.windowDurationMins ?? Infinity);
			})[0];
			return {
				bucket,
				window,
				remainingPercent: Math.max(0, 100 - window.usedPercent)
			};
		}
		function quotaWindows(bucket) {
			if (bucket.windows.length > 0) return bucket.windows;
			return [bucket.primary, bucket.secondary].filter((window) => window !== null);
		}
		//#endregion
		//#region src/client/CodexComposerQuota.tsx
		function CodexComposerQuota({ api, directory, loadModelDirectory, t }) {
			const modelState = useStore(directory);
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [refreshError, setRefreshError] = (0, react.useState)(null);
			const refreshInFlight = (0, react.useRef)(false);
			const mountedRef = (0, react.useRef)(false);
			const selected = modelState.current;
			const isCodex = selected?.provider === CODEX_CHATGPT_PROVIDER_ID;
			const refresh = (0, react.useCallback)(async (force = false) => {
				if (refreshInFlight.current) return;
				refreshInFlight.current = true;
				setLoading(true);
				try {
					if (force) {
						const quota = await api.refreshQuota();
						if (mountedRef.current) setStatus((current) => current === null ? current : { ...current, quota });
					} else {
						const next = await api.status();
						if (mountedRef.current) setStatus(next);
					}
					if (mountedRef.current) setRefreshError(null);
				} catch (error) {
					if (mountedRef.current) setRefreshError(error instanceof Error ? error.message : "");
				} finally {
					refreshInFlight.current = false;
					if (mountedRef.current) setLoading(false);
				}
			}, [api]);
			(0, react.useEffect)(() => {
				loadModelDirectory();
			}, [loadModelDirectory]);
			(0, react.useEffect)(() => {
				mountedRef.current = true;
				return () => {
					mountedRef.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (!isCodex) return;
				void refresh();
				const timer = window.setInterval(() => {
					if (document.visibilityState === "visible") void refresh();
				}, 6e4);
				return () => window.clearInterval(timer);
			}, [refresh, isCodex]);
			const quota = (0, react.useMemo)(() => selectQuotaForModel(status?.quota, selected?.model), [selected?.model, status?.quota]);
			if (!isCodex || status?.preferences.quickQuotaVisible !== true) return null;
			const refreshLabel = refreshError === null ? t("quickQuotaRefresh") : refreshError || t("quickQuotaRefreshFailed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dsh-codex-composer-quota",
				disabled: loading,
				onClick: () => void refresh(true),
				title: refreshLabel,
				"aria-busy": loading,
				"data-level": refreshError !== null ? "warning" : quota === null ? "normal" : quota.remainingPercent <= 5 ? "danger" : quota.remainingPercent <= 20 ? "warning" : "normal",
				"aria-label": `${t("quickQuotaLabel")}: ${quota === null ? "—" : formatPercent$1(quota.remainingPercent)}. ${loading ? t("quickQuotaRefreshing") : refreshLabel}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("quickQuotaLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: loading ? t("quickQuotaRefreshing") : quota === null ? "—" : formatPercent$1(quota.remainingPercent) })]
			});
		}
		function formatPercent$1(value) {
			return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 }).format(value)}%`;
		}
		//#endregion
		//#region src/client/CodexImageToolView.tsx
		function CodexImageToolView({ block, loadImage, t }) {
			const settled = "kind" in block;
			const isError = settled ? block.isError : false;
			const prompt = promptFromBlock(block);
			const images = settled && !isError ? imageBlocks(block.content) : [];
			const label = isError ? t("imageToolFailed") : settled ? t("imageToolDone") : t("imageToolRunning");
			const summary = prompt ?? textSummary(settled ? block.content : []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-codex-image-tool",
				"data-state": isError ? "error" : settled ? "done" : "running",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-codex-image-tool-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-codex-image-dot",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-codex-image-title",
							children: label
						}),
						summary !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-codex-image-summary",
							children: summary
						}) : null
					]
				}), images.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-codex-image-grid",
					children: images.map((attachment) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GeneratedImage, {
						attachment,
						load: loadImage,
						label: attachment.name ?? t("image"),
						t
					}, String(attachment.attachmentId)))
				}) : null]
			});
		}
		function GeneratedImage({ attachment, load, label, t }) {
			const [src, setSrc] = (0, react.useState)(null);
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let disposed = false;
				setSrc(null);
				setFailed(false);
				load(attachment).then((url) => {
					if (!disposed) setSrc(url);
				}, () => {
					if (!disposed) setFailed(true);
				});
				return () => {
					disposed = true;
				};
			}, [attachment, load]);
			if (failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsh-codex-image-failed",
				children: t("imageLoadFailed")
			});
			if (src === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsh-codex-image-loading",
				children: t("imageLoading")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: "dsh-codex-image-preview",
				src,
				alt: label
			});
		}
		function promptFromBlock(block) {
			const partial = partialPromptFromBlock(block);
			if (partial !== null) return partial;
			const raw = "kind" in block ? block.call?.argsRaw : dispatchedArgsRaw(block);
			if (typeof raw !== "string" || raw.trim() === "") return null;
			try {
				const value = JSON.parse(raw);
				return typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.prompt === "string" ? value.prompt : null;
			} catch {
				return null;
			}
		}
		function partialPromptFromBlock(block) {
			if (!("args" in block)) return null;
			const args = block.args;
			if (typeof args?.text !== "function") return null;
			try {
				const prompt = args.text.call(args, "prompt");
				return typeof prompt === "string" ? prompt : null;
			} catch {
				return null;
			}
		}
		/**
		* Arguments of a dispatched call that has no result yet.
		*
		* Harness 0.1.7-rc.1 dispatches a view as soon as its call starts *preparing*,
		* before the arguments exist, so the preparing shape carries no `argsRaw` at
		* all. Older generations only ever sent the dispatched shape.
		*/
		function dispatchedArgsRaw(block) {
			return "argsRaw" in block ? block.argsRaw : void 0;
		}
		function imageBlocks(blocks) {
			const result = [];
			for (const block of blocks) {
				if (block.type === "image") result.push(block.attachment);
				if (block.type === "tool-result") result.push(...imageBlocks(block.content));
			}
			return result;
		}
		function textSummary(blocks) {
			const text = blocks.map((block) => block.type === "text" || block.type === "reasoning" ? block.text : "").filter(Boolean).join(" ").trim();
			return text === "" ? null : text;
		}
		//#endregion
		//#region src/shared/hub-contracts.ts
		/**
		* Wire contracts for the subscription hub's overview route.
		*
		* The overview is the settings page's opening screen: one card per provider
		* line, annotated with how many accounts it holds and whether it is enabled.
		* Everything here is a non-secret fact a settings card may render; no
		* credential, quota figure, or upstream call ever crosses this boundary.
		*/
		/** The aggregated, read-only overview the hub's opening screen renders. */
		const HUB_OVERVIEW_PATH = `${ROUTE_PREFIX}/hub/overview`;
		//#endregion
		//#region src/client/common/account-pool-labels.ts
		/** Chinese labels; the wording the Antigravity card shipped with. */
		const accountPoolZh = {
			accountPool: "账号管理",
			addAccount: "添加账号",
			accountCount: "已登录 {count} 个账号",
			primaryAccount: "主账号",
			activeAccount: "当前使用",
			setPrimary: "设为主账号",
			deleteAccount: "删除",
			cooling: "冷却中",
			cooldownLeft: "剩 {minutes} 分",
			clearCooldown: "重置冷却",
			needsRelogin: "需重新登录",
			relogin: "重新登录",
			rotationStrategy: "调度策略",
			strategySequential: "顺序耗尽（当前优先，遇限流自动切号）",
			strategyRoundRobin: "轮询调度（按账号循环均匀分摊）",
			strategySticky: "粘性会话（保持当前账号，遇限流才切换）",
			noAccounts: "暂无账号，点击「添加账号」完成登录授权。",
			email: "邮箱",
			expires: "令牌到期",
			lastUsed: "上次调用",
			accountId: "账号 ID",
			accountQuota: "配额",
			quotaNone: "尚无配额数据",
			quotaSnapshot: "快照 {time}",
			quotaResets: "重置",
			quotaExhausted: "已用尽",
			quotaWindow: "额度窗口",
			quotaUsed: "已用",
			quotaFactsScope: "以下为当前账号的配额事实；每个账号自己的进度显示在它的账号卡片里。",
			composerLabel: "额度"
		};
		/** English labels for the ChatGPT tab, which is the bilingual one. */
		const accountPoolEn = {
			accountPool: "Account Management",
			addAccount: "Add Account",
			accountCount: "{count} account(s) signed in",
			primaryAccount: "Primary",
			activeAccount: "In Use",
			setPrimary: "Set as Primary",
			deleteAccount: "Delete",
			cooling: "In Cooldown",
			cooldownLeft: "{minutes} min left",
			clearCooldown: "Clear Cooldown",
			needsRelogin: "Sign-in required",
			relogin: "Sign in again",
			rotationStrategy: "Scheduling Strategy",
			strategySequential: "Sequential Drain (primary first, fail over on 429)",
			strategyRoundRobin: "Round-Robin (evenly rotate across accounts)",
			strategySticky: "Sticky Session (keep the current account until it is limited)",
			noAccounts: "No accounts yet. Click \"Add Account\" to authorize.",
			email: "Email",
			expires: "Token expires",
			lastUsed: "Last used",
			accountId: "Account ID",
			accountQuota: "Quota",
			quotaNone: "No quota read yet",
			quotaSnapshot: "Snapshot {time}",
			quotaResets: "Resets",
			quotaExhausted: "Exhausted",
			quotaWindow: "Limit window",
			quotaUsed: "used",
			quotaFactsScope: "These facts describe the current account; each account’s own progress is shown on its card above.",
			composerLabel: "Quota"
		};
		/** Replace `{name}` placeholders in one label. */
		function formatPoolLabel(template, values) {
			return template.replace(/\{(\w+)\}/g, (match, name) => name in values ? String(values[name]) : match);
		}
		//#endregion
		//#region src/client/hub/brand-svg.ts
		const BRAND_MARKS = {
			"openai": {
				viewBox: "0 -0.225 1.45 1.45",
				body: "<g transform=\"translate(-0.2852 -2.0104) scale(0.002787)\"><g fill=\"currentColor\"><path d=\"M583.793,841.346c11.778,-44.127 0.356,-93.159 -34.264,-127.777c-34.616,-34.618 -83.65,-46.041 -127.777,-34.264c-32.329,-32.262 -80.503,-46.887 -127.794,-34.215c-47.289,12.672 -81.694,49.424 -93.563,93.526c-44.102,11.866 -80.854,46.274 -93.523,93.564c-12.673,47.289 1.952,95.462 34.214,127.791c-11.776,44.126 -0.354,93.16 34.264,127.777c34.618,34.62 83.651,46.041 127.779,34.264c32.329,32.263 80.503,46.888 127.79,34.215c47.289,-12.672 81.695,-49.425 93.564,-93.526c44.104,-11.865 80.857,-46.274 93.526,-93.563c12.672,-47.291 -1.952,-95.462 -34.216,-127.792Zm-179.693,-124.105c39.682,-22.943 91.303,-17.439 125.254,16.511c23.963,23.965 33.748,56.745 29.367,87.904l-111.77,-64.53c-4.415,-2.549 -9.855,-2.549 -14.27,0l-130.876,75.563l0,-50.806c0,-3.427 1.837,-6.63 4.803,-8.343l97.49,-56.297l0.002,-0.002Zm-41.659,113.397l60.638,35.01l0,70.02l-60.638,35.01l-60.639,-35.01l0,-70.02l60.639,-35.01Zm-138.015,-57.766c-0.029,-45.836 30.549,-87.793 76.926,-100.217c32.734,-8.773 66.015,-0.856 90.81,18.518l-111.768,64.53c-4.415,2.549 -7.134,7.261 -7.134,12.359l0,151.125l-44.001,-25.405c-2.967,-1.715 -4.824,-4.909 -4.824,-8.332l-0.009,-112.576l0,-0.002Zm-89.99,66.69c8.773,-32.735 32.268,-57.601 61.443,-69.386l0,129.056c0,5.099 2.719,9.81 7.134,12.359l130.877,75.564l-44.002,25.405c-2.964,1.713 -6.661,1.724 -9.627,0.011l-97.498,-56.279c-39.71,-22.893 -60.754,-70.353 -48.329,-116.727l0.002,-0.003Zm186.345,244.515c-39.681,22.943 -91.303,17.437 -125.253,-16.512c-23.965,-23.965 -33.749,-56.745 -29.368,-87.904l111.769,64.53c4.414,2.549 9.856,2.549 14.271,0l130.876,-75.564l0,50.807c0,3.429 -1.837,6.632 -4.803,8.343l-97.49,56.298l-0.002,0.002Zm179.675,-55.631c0.028,45.837 -30.55,87.793 -76.927,100.216c-32.736,8.774 -66.017,0.856 -90.81,-18.519l111.767,-64.529c4.417,-2.549 7.136,-7.262 7.136,-12.359l0,-151.123l44.001,25.404c2.965,1.713 4.824,4.909 4.824,8.332l0.009,112.578Zm89.986,-66.691c-8.773,32.735 -32.268,57.601 -61.444,69.387l0,-129.058c0,-5.097 -2.718,-9.808 -7.133,-12.359l-130.878,-75.562l44.002,-25.405c2.965,-1.714 6.662,-1.726 9.628,-0.012l97.497,56.278c39.712,22.893 60.754,70.355 48.329,116.729l-0.001,0.002Z\" style=\"\"/></g></g>"
			},
			"gemini": {
				viewBox: "0 -0.1644 1.329 1.329",
				body: "<g transform=\"translate(-0.0604 -0.2250) scale(0.060417)\"><g><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"#3186FF\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-0-_R_0_)\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-1-_R_0_)\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-2-_R_0_)\"></path><defs><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-0-_R_0_\" x1=\"7\" x2=\"11\" y1=\"15.5\" y2=\"12\"><stop stop-color=\"#08B962\"></stop><stop offset=\"1\" stop-color=\"#08B962\" stop-opacity=\"0\"></stop></linearGradient><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-1-_R_0_\" x1=\"8\" x2=\"11.5\" y1=\"5.5\" y2=\"11\"><stop stop-color=\"#F94543\"></stop><stop offset=\"1\" stop-color=\"#F94543\" stop-opacity=\"0\"></stop></linearGradient><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-2-_R_0_\" x1=\"3.5\" x2=\"17.5\" y1=\"13.5\" y2=\"12\"><stop stop-color=\"#FABC12\"></stop><stop offset=\".46\" stop-color=\"#FABC12\" stop-opacity=\"0\"></stop></linearGradient></defs></g></g>"
			},
			"kimi": {
				viewBox: "0.0488 -0.225 1.2083 1.2083",
				body: "<g transform=\"translate(-0.1812 -0.2250) scale(0.060417)\"><g><path d=\"M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z\" fill=\"#1783FF\"></path><path d=\"M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z\" fill=\"currentColor\"></path></g></g>"
			},
			"minimax": {
				viewBox: "0 -0.225 1.45 1.45",
				body: "<g transform=\"translate(-0.0000 -0.2250) scale(0.060417)\"><g><defs><linearGradient id=\"lobe-icons-minimax-_R_0_\" x1=\"0%\" x2=\"100.182%\" y1=\"50.057%\" y2=\"50.057%\"><stop offset=\"0%\" stop-color=\"#E2167E\"></stop><stop offset=\"100%\" stop-color=\"#FE603C\"></stop></linearGradient></defs><path d=\"M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z\" fill=\"url(#lobe-icons-minimax-_R_0_)\" fill-rule=\"nonzero\"></path></g></g>"
			},
			"tencent": {
				viewBox: "0 -0.225 1.45 1.45",
				body: "<g transform=\"translate(-0.0000 -0.2250) scale(0.060417)\"><g><circle cx=\"12\" cy=\"12\" fill=\"#0055E9\" r=\"12\"></circle><path d=\"M12 0c.518 0 1.028.033 1.528.096A6.188 6.188 0 0112.12 12.28l-.12.001c-2.99 0-5.242 2.179-5.554 5.11-.223 2.086.353 4.412 2.242 6.146C3.672 22.1 0 17.479 0 12 0 5.373 5.373 0 12 0z\" fill=\"currentColor\"></path><path d=\"M5.286 5a2.438 2.438 0 01.682 3.38c-3.962 5.966-3.215 10.743 2.648 15.136C3.636 22.056 0 17.452 0 12c0-1.787.39-3.482 1.09-5.006.253-.435.525-.872.817-1.311A2.438 2.438 0 015.286 5z\" fill=\"#0055E9\"></path><path d=\"M12.98.04c.272.021.543.053.81.093.583.106 1.117.254 1.538.44 6.638 2.927 8.07 10.052 1.748 15.642a4.125 4.125 0 01-5.822-.358c-1.51-1.706-1.3-4.184.357-5.822.858-.848 3.108-1.223 4.045-2.441 1.257-1.634 2.122-6.009-2.523-7.506L12.98.039z\" fill=\"#00BCFF\"></path><path d=\"M13.528.096A6.187 6.187 0 0112 12.281a5.75 5.75 0 00-1.71.255c.147-.905.595-1.784 1.321-2.501.858-.848 3.108-1.223 4.045-2.441 1.27-1.651 2.14-6.104-2.676-7.554.184.014.367.033.548.056z\" fill=\"#ECECEE\"></path></g></g>"
			},
			"qwen": {
				viewBox: "-0.0125 -0.1646 1.3417 1.3417",
				body: "<g transform=\"translate(-0.0604 -0.2250) scale(0.060417)\"><g><path d=\"M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z\" fill=\"url(#lobe-icons-qwen-_R_0_)\" fill-rule=\"nonzero\"></path><defs><linearGradient id=\"lobe-icons-qwen-_R_0_\" x1=\"0%\" x2=\"100%\" y1=\"0%\" y2=\"0%\"><stop offset=\"0%\" stop-color=\"#6336E7\" stop-opacity=\".84\"></stop><stop offset=\"100%\" stop-color=\"#6F69F7\" stop-opacity=\".84\"></stop></linearGradient></defs></g></g>"
			},
			"deepseek": {
				viewBox: "0 -0.2352 1.45 1.45",
				body: "<g transform=\"translate(-0.0000 -0.2250) scale(0.060417)\"><g><path d=\"M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z\" fill=\"#4D6BFE\"></path></g></g>"
			},
			"grok": {
				viewBox: "0 -0.2237 1.45 1.45",
				body: "<g transform=\"translate(-0.0000 -0.2250) scale(0.060417)\"><g fill=\"#000\" fill-rule=\"evenodd\"><path d=\"M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815\"></path></g></g>"
			},
			"claude": {
				viewBox: "0 0 148.09 148.18",
				body: "<g transform='translate(-75.96,-223.53)'><path d='m 105.01,322.07 29.14,-16.35 0.49,-1.42 -0.49,-0.79 h -1.42 l -4.87,-0.3 -16.65,-0.45 -14.44,-0.6 -13.99,-0.75 -3.52,-0.75 -3.3,-4.35 0.34,-2.17 2.96,-1.99 4.24,0.37 9.37,0.64 14.06,0.97 10.2,0.6 15.11,1.57 h 2.4 l 0.34,-0.97 -0.82,-0.6 -0.64,-0.6 -14.55,-9.86 -15.75,-10.42 -8.25,-6 -4.46,-3.04 -2.25,-2.85 -0.97,-6.22 4.05,-4.46 5.44,0.37 1.39,0.37 5.51,4.24 11.77,9.11 15.37,11.32 2.25,1.87 0.9,-0.64 0.11,-0.45 -1.01,-1.69 -8.36,-15.11 -8.92,-15.37 -3.97,-6.37 -1.05,-3.82 c -0.37,-1.57 -0.64,-2.89 -0.64,-4.5 l 4.61,-6.26 2.55,-0.82 6.15,0.82 2.59,2.25 3.82,8.74 6.19,13.76 9.6,18.71 2.81,5.55 1.5,5.14 0.56,1.57 h 0.97 v -0.9 l 0.79,-10.54 1.46,-12.94 1.42,-16.65 0.49,-4.69 2.32,-5.62 4.61,-3.04 3.6,1.72 2.96,4.24 -0.41,2.74 -1.76,11.44 -3.45,17.92 -2.25,12 h 1.31 l 1.5,-1.5 6.07,-8.06 10.2,-12.75 4.5,-5.06 5.25,-5.59 3.37,-2.66 h 6.37 l 4.69,6.97 -2.1,7.2 -6.56,8.32 -5.44,7.05 -7.8,10.5 -4.87,8.4 0.45,0.67 1.16,-0.11 17.62,-3.75 9.52,-1.72 11.36,-1.95 5.14,2.4 0.56,2.44 -2.02,4.99 -12.15,3 -14.25,2.85 -21.22,5.02 -0.26,0.19 0.3,0.37 9.56,0.9 4.09,0.22 h 10.01 l 18.64,1.39 4.87,3.22 2.92,3.94 -0.49,3 -7.5,3.82 -10.12,-2.4 -23.62,-5.62 -8.1,-2.02 h -1.12 v 0.67 l 6.75,6.6 12.37,11.17 15.49,14.4 0.79,3.56 -1.99,2.81 -2.1,-0.3 -13.61,-10.24 -5.25,-4.61 -11.89,-10.01 h -0.79 v 1.05 l 2.74,4.01 14.47,21.75 0.75,6.67 -1.05,2.17 -3.75,1.31 -4.12,-0.75 -8.47,-11.89 -8.74,-13.39 -7.05,-12 -0.86,0.49 -4.16,44.81 -1.95,2.29 -4.5,1.72 -3.75,-2.85 -1.99,-4.61 1.99,-9.11 2.4,-11.89 1.95,-9.45 1.76,-11.74 1.05,-3.9 -0.07,-0.26 -0.86,0.11 -8.85,12.15 -13.46,18.19 -10.65,11.4 -2.55,1.01 -4.42,-2.29 0.41,-4.09 2.47,-3.64 14.74,-18.75 8.89,-11.62 5.74,-6.71 -0.04,-0.97 h -0.34 l -39.15,25.42 -6.97,0.9 -3,-2.81 0.37,-4.61 1.42,-1.5 11.77,-8.1 -0.04,0.04 z'/></g>"
			}
		};
		//#endregion
		//#region src/client/hub/brand-icons.tsx
		/**
		* Provider and vendor brand marks for the hub overview cards and the shared
		* model checklist.
		*
		* The artwork lives in brand-svg.ts as inline strings (extracted from the
		* vendored combine lockups); this module adds the presentation: a rounded,
		* brand-tinted tile for provider cards, a bare mark for model rows, and the
		* ordered model-id → vendor rules. A model no rule claims draws no mark at
		* all — a wrong vendor's mark reads as a wrong answer, not a missing one
		* (the same principle claude-style's brand.js documents).
		*/
		/** 本文件自带的标记（BRAND_MARKS 之外的补充，按键索引）。 */
		const LOCAL_MARKS = {
			glm: {
				viewBox: "0 0 31.5 26.5273",
				body: "<path d=\"M16.5376 0.0307374L14.3326 3.13223C14.1617 3.37577 13.9331 3.57415 13.6667 3.71001C13.4004 3.84586 13.1045 3.91504 12.8048 3.9115H0.787598V0.015152H16.5376V0.0307374Z\" fill=\"currentColor\"/><path d=\"M31.5 0.0321655L12.6 26.5273H0L18.9 0.0321655H31.5Z\" fill=\"currentColor\"/><path d=\"M14.9624 26.5272L17.1832 23.4101C17.3564 23.1689 17.5856 22.9723 17.8513 22.8368C18.1171 22.7012 18.4119 22.6306 18.7109 22.6308H30.7124V26.5272H14.9624Z\" fill=\"currentColor\"/>"
			},
			"step-code": {
				viewBox: "0 0 64 64",
				body: "<path d=\"M33.76 43.03v-8.84h18.05v1.58H41.56v16.1h-7.8zm-21.57-4.39h9.3l-.02-10.4-.01-10.38h25.15l.02 7.62H29.37v20.8H12.2Zm4.28-23.24h1.58v17.67h-1.58zm32.28-.07h-3.23v-1.57h3.23v-1.57h1.54v1.57h1.58l-.01.79v.79h-1.57v3.19h-1.54v-3.2\" fill=\"currentColor\"/>"
			}
		};
		function artworkOf(mark) {
			return mark in BRAND_MARKS ? BRAND_MARKS[mark] : LOCAL_MARKS[mark];
		}
		const PROVIDER_BRANDS = {
			chatgpt: {
				mark: "openai",
				color: "#10A37F",
				tile: "#10A37F"
			},
			antigravity: {
				mark: "gemini",
				tile: "#3186FF"
			},
			"command-code": {
				monogram: ">_",
				color: "#7C6AEF",
				tile: "#7C6AEF"
			},
			"kimi-code": {
				mark: "kimi",
				color: "#1F1F1F",
				tile: "#1783FF"
			},
			workbuddy: {
				mark: "tencent",
				tile: "#0055E9"
			},
			vertex: {
				mark: "gemini",
				tile: "#4285F4"
			},
			aistudio: {
				mark: "gemini",
				tile: "#1A73E8"
			},
			"minimax-code": {
				mark: "minimax",
				tile: "#E2167E"
			},
			"glm-coding-plan": {
				mark: "glm",
				color: "#ffffff",
				tile: "#3859FF"
			},
			claude: {
				mark: "claude",
				color: "#D97757",
				tile: "#D97757"
			},
			ollama: {
				monogram: "O",
				color: "#3B3B3B",
				tile: "#3B3B3B"
			},
			"step-code": {
				mark: "step-code",
				color: "#ffffff",
				tile: "#1d1d1d"
			}
		};
		/** One brand mark at a given box size; the artwork is decorative. */
		function BrandMark({ mark, color, size = 22 }) {
			const art = artworkOf(mark);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				"aria-hidden": "true",
				viewBox: art.viewBox,
				width: size,
				height: size,
				style: color === void 0 ? void 0 : { color },
				dangerouslySetInnerHTML: { __html: art.body }
			});
		}
		/**
		* The overview card's logo tile: the mark centered on a rounded square tinted
		* with the brand color, in the QQ-mail idiom. The tile element doubles as the
		* fallback surface for monogram providers.
		*/
		function BrandTile({ id, size = 40 }) {
			const brand = PROVIDER_BRANDS[id];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsh-hub-brand-tile",
				"aria-hidden": "true",
				style: {
					width: size,
					height: size,
					["--dsh-hub-brand"]: brand.tile
				},
				children: brand.mark !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {
					mark: brand.mark,
					color: brand.color,
					size: Math.round(size * .58)
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-hub-brand-mono",
					style: brand.color === void 0 ? void 0 : { color: brand.color },
					children: brand.monogram
				})
			});
		}
		/**
		* The vendor that made one model, resolved from its id. Ordered: the first
		* matching rule wins, so a specific rule ('kimi') precedes a looser one.
		*/
		const MODEL_BRAND_RULES = [
			{
				re: /glm|zhipu|\bz\.ai\b/,
				mark: "glm"
			},
			{
				re: /gpt|codex|o[0-9]/,
				mark: "openai"
			},
			{
				re: /claude|anthropic/,
				mark: "claude"
			},
			{
				re: /kimi|moonshot|\bk[0-9]/,
				mark: "kimi"
			},
			{
				re: /minimax|\bm[0-9]/,
				mark: "minimax"
			},
			{
				re: /gemini/,
				mark: "gemini"
			},
			{
				re: /qwen/,
				mark: "qwen"
			},
			{
				re: /deepseek/,
				mark: "deepseek"
			},
			{
				re: /grok/,
				mark: "grok"
			}
		];
		function modelBrandMark(modelId) {
			const id = modelId.toLowerCase();
			for (const rule of MODEL_BRAND_RULES) if (rule.re.test(id)) return rule.mark;
			return null;
		}
		//#endregion
		//#region src/shared/glm-coding-plan-contracts.ts
		/** 线路 id。与用户自建的 `zai` / `zhipu` 兼容路由、已退役的 `zhipu-coding-plan` 都不同名（D1）。 */
		const GLM_CODING_PLAN_PROVIDER_ID = "glm-coding-plan";
		/** 设置卡片与 hub 卡片上显示的名字（D1）。 */
		const GLM_CODING_PLAN_PROVIDER_NAME = "GLM（ZCode 账号）";
		/**
		* 路由前缀（host 暴露、client 消费）。
		*
		* 与其余各订阅线路一致：每条线路把自己的设置面挂在 `/<line>/api` 下，
		* 不挂到 Codex 那条线路的 `/wb/api/dsh-chatgpt-subscription` 前缀下面。
		*/
		const GLM_CODING_PLAN_ROUTE_PREFIX = "/wb/glm-coding-plan/api";
		/** 区域参数是否落在这条线路认识的部署上（供 route 层校验自由输入的 region）。 */
		function isGlmRegion(value) {
			return value === "cn" || value === "intl";
		}
		//#endregion
		//#region src/shared/step-code-contracts.ts
		/** 线路 id。与官方客户端的 `step` 不同名，也不与既有任何线路重名。 */
		const STEP_CODE_PROVIDER_ID = "step-code";
		/** 设置卡片与 hub 卡片上显示的名字。 */
		const STEP_CODE_PROVIDER_NAME = "Step Code（Step Plan 订阅）";
		/**
		* 路由前缀（host 暴露、client 消费）。
		*
		* 与其余各订阅线路一致：每条线路把自己的设置面挂在 `/<line>/api` 下，
		* 不挂到 Codex 那条线路的 `/wb/api/dsh-chatgpt-subscription` 前缀下面。
		*/
		const STEP_CODE_ROUTE_PREFIX = "/wb/step-code/api";
		/**
		* 全部 profile，声明顺序即设置页的默认顺序。
		*
		* 它是**线路认识的凭据清单**，不是模型清单，也不是凭据优先级。
		*/
		const STEP_CODE_PROFILES = [
			"step_plan",
			"step_plan_oversea",
			"platform_cn",
			"platform_oversea"
		];
		/**
		* profile → 区域。
		*
		* 这是四行 profile 表里**唯一**由 profile 自述、无需再查端点的映射，所以放进共享契约：
		* host 与 client 都要在只拿到 profile 的场合回答区域（卡片列、区域徽标、
		* 跨区报错的措辞），两份实现各写一张表就是一次漂移。
		*
		* 逐条照抄官方 `PROFILE_DEFINITIONS`（`step/onboarding.ts:33-83`）的域名：
		* `.com` 是国区、`.ai` 是国际区。
		*/
		const REGION_BY_PROFILE = {
			step_plan: "cn",
			step_plan_oversea: "intl",
			platform_cn: "cn",
			platform_oversea: "intl"
		};
		/** 一个 profile 属于哪个区域；profile 已在联合类型上，这里不做运行时校验。 */
		function stepCodeRegionOf(profile) {
			return REGION_BY_PROFILE[profile];
		}
		/** 参数是否是本线路认识的 profile（供 route 层校验自由输入）。 */
		function isStepCodeProfile(value) {
			return typeof value === "string" && STEP_CODE_PROFILES.includes(value);
		}
		/**
		* 线路级档位词汇表，从低到高。
		*
		* 设置卡片只渲染这一份列表——它是**线路级词汇表**，不是某个模型的能力表。
		* 某个模型真实接受哪些档位由 `StepCodeModelOption.reasoningEfforts` 单独给出；
		* 把两者合成一份会让卡片在给一个只认两档的模型显示六档时，
		* 无从判断是模型不支持还是文案没写。
		*
		* 它比上游宽是**故意的**：上游的 `reasoning_effort_support_list` 是逐模型声明的
		* （未在列表里的档位映射为「不支持」，含关闭值），所以宽表在本地收敛即可，
		* 而窄表一旦上游加了新档位就无处安放。
		*/
		const STEP_CODE_REASONING_EFFORTS = [
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/** 档位参数是否是本线路词汇表里的值（供 route 层校验自由输入）。 */
		function isStepCodeReasoningEffort(value) {
			return typeof value === "string" && STEP_CODE_REASONING_EFFORTS.includes(value);
		}
		/**
		* 响应侧「缓存读入量」的解析优先级，从先到后。
		*
		* 这条链是本线路最容易被想当然的一处，顺序有理由：
		*
		* 1. `prompt_tokens_details.cached_tokens` —— OpenAI 规范的字段，最优先。
		* 2. `cache_read_input_tokens` —— Anthropic 规范的字段，出现在同包时说明端点混用两套词汇。
		* 3. **顶层 `cached_tokens`** —— Step 官方文档只给这个字段（命中判据就是它 > 0），
		*    所以它必须**在自己那条分支上被认**，而不是只当作别人的兜底。
		* 4. `prompt_cache_hit_tokens` —— DeepSeek 一族的命名。
		* 5. 0。
		*
		* 都不命中时取 0：0 表示「上游没报」，而不是「一定没命中」——
		* 命中与否由用户对照 `fetchedAt` 与自己的前缀长度判断。
		*/
		const STEP_CODE_CACHE_READ_FIELD_ORDER = [
			"prompt_tokens_details.cached_tokens",
			"cache_read_input_tokens",
			"cached_tokens",
			"prompt_cache_hit_tokens"
		];
		/**
		* 缓存**写**入量在本线路恒为 0，卡片据此显式声明。
		*
		* Step 服务端是自动前缀缓存：前缀够了就命中，客户端没有「写入」这个动作，
		* 也没有对应的计费项。所以任何声称本线路写过缓存的数字都是编的。
		* 该常量由波次 2B 的 mapper 填进用量对象，让卡片如实标注而不是留一个看起来像 bug 的 0。
		*/
		const STEP_CODE_CACHE_WRITE_NOTE = "always-zero-on-this-route";
		//#endregion
		//#region src/shared/model-catalog.ts
		const GPT_56_MAX_CONTEXT_WINDOW = 1e6;
		const GPT_6_MAX_CONTEXT_WINDOW = 872e3;
		/** Effective context the GPT-6 family starts at, before any user override. */
		const GPT_6_DEFAULT_CONTEXT_WINDOW = 384e3;
		/** Output cap of the GPT-6 family; the vendor declares 128K for all three. */
		const GPT_6_MAX_TOKENS = 128e3;
		const CODEX_MODEL_CATALOG = [
			{
				id: "gpt-5.6-sol",
				name: "5.6 Sol",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-5.6",
				supportsReasoningSummary: true,
				fallbackModelId: "gpt-5.6-terra",
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-6-astra",
				name: "6 Astra",
				contextWindow: GPT_6_DEFAULT_CONTEXT_WINDOW,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-6",
				supportsReasoningSummary: true,
				maxTokens: GPT_6_MAX_TOKENS,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-6.1-sol",
				name: "6.1 Sol",
				contextWindow: GPT_6_DEFAULT_CONTEXT_WINDOW,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-6",
				supportsReasoningSummary: true,
				maxTokens: GPT_6_MAX_TOKENS,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-6.1-terra",
				name: "6.1 Terra",
				contextWindow: GPT_6_DEFAULT_CONTEXT_WINDOW,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-6",
				supportsReasoningSummary: true,
				maxTokens: GPT_6_MAX_TOKENS,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-6-sol",
				name: "6 Sol",
				contextWindow: GPT_6_DEFAULT_CONTEXT_WINDOW,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-6",
				supportsReasoningSummary: true,
				maxTokens: GPT_6_MAX_TOKENS,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-6-luna",
				name: "6 Luna",
				contextWindow: GPT_6_DEFAULT_CONTEXT_WINDOW,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-6",
				supportsReasoningSummary: true,
				maxTokens: GPT_6_MAX_TOKENS,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-5.6-terra",
				name: "5.6 Terra",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-5.6",
				supportsReasoningSummary: true,
				fallbackModelId: "gpt-5.5",
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-5.6-luna",
				name: "5.6 Luna",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "gpt-5.6",
				supportsReasoningSummary: true,
				fallbackModelId: "gpt-5.5",
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-5.5",
				name: "5.5",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "medium",
				reasoningProfile: "standard",
				supportsReasoningSummary: true,
				supportsOutputVerbosity: true,
				defaultOutputVerbosity: "low"
			},
			{
				id: "gpt-5.4",
				name: "5.4",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "none",
				reasoningProfile: "standard",
				supportsReasoningSummary: true,
				fallbackModelId: "gpt-5.4-mini"
			},
			{
				id: "gpt-5.4-mini",
				name: "5.4 Mini",
				contextWindow: 272e3,
				inputModalities: ["text", "image"],
				defaultReasoningEffort: "none",
				reasoningProfile: "standard",
				supportsReasoningSummary: true
			},
			{
				id: "gpt-5.3-codex-spark",
				name: "5.3 Codex Spark",
				contextWindow: 258e3,
				inputModalities: ["text"],
				defaultReasoningEffort: "high",
				reasoningProfile: "standard",
				supportsReasoningSummary: false
			}
		];
		const DEFAULT_VISIBLE_CODEX_MODEL_IDS = [
			"gpt-6-astra",
			"gpt-6.1-sol",
			"gpt-6.1-terra",
			"gpt-6-sol",
			"gpt-6-luna",
			"gpt-5.6-sol",
			"gpt-5.6-terra",
			"gpt-5.6-luna"
		];
		const DEFAULT_CODEX_MODEL = CODEX_MODEL_CATALOG[0];
		/**
		* Upper bound for one model's context window override. The Codex subscription
		* caps the whole GPT-6 family at 872K and everything older at 1M, so a model's
		* catalog default is where the number starts, not where it has to stay.
		*/
		function contextWindowLimitForModel(model) {
			return resolveCodexCatalogEntry(model).reasoningProfile === "gpt-6" ? GPT_6_MAX_CONTEXT_WINDOW : GPT_56_MAX_CONTEXT_WINDOW;
		}
		function resolveCodexCatalogEntry(model) {
			return CODEX_MODEL_CATALOG.find((entry) => entry.id === model) ?? DEFAULT_CODEX_MODEL;
		}
		//#endregion
		//#region src/client/api.ts
		var SubscriptionApi = class {
			status() {
				return request$2(`${ROUTE_PREFIX}/status`);
			}
			startLogin() {
				return post$4(`${ROUTE_PREFIX}/login/start`, {});
			}
			cancelLogin(loginId) {
				return post$4(`${ROUTE_PREFIX}/login/cancel`, { loginId });
			}
			/** Sign out one pooled account; without an id, the active one. */
			logout(accountId) {
				return post$4(`${ROUTE_PREFIX}/logout`, accountId === void 0 ? {} : { accountId });
			}
			/**
			* One account-pool action, returning the refreshed status.
			*
			* The host answers with the same envelope the status route uses, so the card
			* never has to guess what the pool looks like after a change.
			*/
			accountAction(action, body = {}) {
				return post$4(`${ROUTE_PREFIX}/accounts`, {
					action,
					...body
				});
			}
			/**
			* Import this machine's Codex CLI sign-in, answering with the refreshed status.
			*
			* The body names the source rather than the URL carrying it, so the host can
			* refuse a sign-in it does not import with a sentence instead of a silent
			* no-op. The type is 'codex' alone on purpose: Claude Code and MiniMax Code are
			* imported from their own provider settings, and a union here would invite a
			* call the host always answers with a 400.
			*/
			adoptLocalLogin(source) {
				return post$4(`${ROUTE_PREFIX}/adopt`, { source });
			}
			/** Forget every imported snapshot. The CLIs' own files are never touched. */
			disableAdoptedLocalLogins() {
				return post$4(`${ROUTE_PREFIX}/adopt/disable`, {});
			}
			refresh() {
				return post$4(`${ROUTE_PREFIX}/token/refresh`, {});
			}
			refreshQuota() {
				return post$4(`${ROUTE_PREFIX}/quota/refresh`, {});
			}
			useResetCredit() {
				return post$4(`${ROUTE_PREFIX}/quota/reset-credit/use`, {});
			}
			testConnection() {
				return post$4(`${ROUTE_PREFIX}/connection/test`, {});
			}
			refreshCatalog() {
				return post$4(`${ROUTE_PREFIX}/catalog/refresh`, {});
			}
			updatePreferences(patch) {
				return post$4(`${ROUTE_PREFIX}/preferences/update`, patch);
			}
			events(loginId) {
				return new EventSource(`${ROUTE_PREFIX}/login/events?loginId=${encodeURIComponent(loginId)}`);
			}
		};
		async function post$4(url, body) {
			return request$2(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		async function request$2(url, init) {
			const response = await fetch(url, {
				...init,
				credentials: "same-origin"
			});
			const envelope = await response.json();
			if (!response.ok || !envelope.ok) throw new Error(envelope.ok ? `Request failed (${response.status})` : envelope.error.message);
			return envelope.value;
		}
		function parseLoginEvent(event) {
			try {
				const value = JSON.parse(event.data);
				return typeof value === "object" && value !== null && typeof value.type === "string" ? value : null;
			} catch {
				return null;
			}
		}
		//#endregion
		//#region src/client/common/account-quota.tsx
		/**
		* Percent with at most one decimal.
		*
		* A share that is not a finite number renders as `0%` rather than `NaN%`. Every
		* caller has already tested `Number.isFinite` and skips the row, so this is the
		* last line of defence, not a claim about an unmeasured window.
		*/
		function formatQuotaPercent(value) {
			if (!Number.isFinite(value)) return "0%";
			try {
				return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value)}%`;
			} catch {
				return `${value}%`;
			}
		}
		/**
		* When a window reopens, in the reader's own words.
		*
		* Always a distance. The page's own quota block counts down ("7天 3时"), and a
		* row that switched to an absolute date past a threshold described the same
		* window two different ways inside one card. Days carry a long window, hours
		* the short ones, minutes the last stretch.
		*/
		function formatQuotaReset(resetsAt, now = Date.now()) {
			if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt) || resetsAt <= now) return "—";
			const deltaMinutes = Math.round((resetsAt - now) / 6e4);
			try {
				const relative = new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });
				if (deltaMinutes < 60) return relative.format(deltaMinutes, "minute");
				if (deltaMinutes < 2160) return relative.format(Math.round(deltaMinutes / 60), "hour");
				return relative.format(Math.round(deltaMinutes / 1440), "day");
			} catch {
				return "—";
			}
		}
		/**
		* When the snapshot was read.
		*
		* A time alone reads as "just now" — which is a lie about a snapshot taken
		* yesterday, and the card's whole promise is that this is what we last saw.
		*/
		function formatQuotaSnapshot(fetchedAt, now = Date.now()) {
			try {
				const sameDay = new Date(fetchedAt).toDateString() === new Date(now).toDateString();
				return new Intl.DateTimeFormat(void 0, sameDay ? { timeStyle: "short" } : {
					dateStyle: "short",
					timeStyle: "short"
				}).format(fetchedAt);
			} catch {
				return "—";
			}
		}
		/** A window's name: the line's own label, else its length, else a generic one. */
		function quotaWindowLabel(window, labels) {
			if (window.label !== "") return window.label;
			const minutes = window.windowDurationMins;
			if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return labels.quotaWindow;
			const [value, unit] = minutes % 1440 === 0 ? [minutes / 1440, "day"] : minutes % 60 === 0 ? [minutes / 60, "hour"] : [Math.round(minutes), "minute"];
			try {
				return new Intl.NumberFormat(void 0, {
					style: "unit",
					unit,
					unitDisplay: "long"
				}).format(value);
			} catch {
				return `${value} ${unit}`;
			}
		}
		function levelFor$1(usedPercent) {
			return usedPercent >= 95 ? "danger" : usedPercent >= 80 ? "warning" : "normal";
		}
		/**
		* One account's quota, or the honest statement that none was ever read.
		*
		* `showEmpty` lets the hosting card stay quiet on a line that has no quota to
		* speak of, while still saying "not read yet" for an account the line does read
		* (its active one, or any account once a sibling has a snapshot).
		*/
		function AccountQuota(props) {
			const { quota, labels } = props;
			if (quota === void 0) return props.showEmpty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-account-quota",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsha-account-quota-empty",
					children: labels.quotaNone
				})
			}) : null;
			const now = props.now ?? Date.now();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-account-quota",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsha-account-quota-head",
					children: [labels.accountQuota, quota.fetchedAt > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: formatPoolLabel(labels.quotaSnapshot, { time: formatQuotaSnapshot(quota.fetchedAt, now) }) })]
				}), quota.windows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsha-account-quota-empty",
					children: labels.quotaNone
				}) : quota.windows.map((window, index) => {
					const percent = Number.isFinite(window.usedPercent) ? window.usedPercent : 0;
					const label = quotaWindowLabel(window, labels);
					const reset = formatQuotaReset(window.resetsAt, now);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-account-quota-row",
						"data-level": levelFor$1(percent),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsha-account-quota-name",
								title: label,
								children: label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsha-account-quota-track",
								role: "progressbar",
								"aria-label": `${label}: ${formatQuotaPercent(percent)} ${labels.quotaUsed}`,
								"aria-valuemin": 0,
								"aria-valuemax": 100,
								"aria-valuenow": percent,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
									className: "dsha-account-quota-fill",
									style: { width: `${Math.min(100, Math.max(0, percent))}%` }
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsha-account-quota-value",
								children: percent >= 100 ? labels.quotaExhausted : formatQuotaPercent(percent)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsha-account-quota-meta",
								children: reset === "—" ? "—" : `${labels.quotaResets} ${reset}`
							})
						]
					}, `${label}:${index}`);
				})]
			});
		}
		//#endregion
		//#region src/client/common/AccountPoolSection.tsx
		/** Format one account timestamp the way every tab renders it. */
		function formatAccountDate(ms) {
			if (!ms || ms <= 0) return "—";
			try {
				return new Intl.DateTimeFormat(void 0, {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(ms);
			} catch {
				return "—";
			}
		}
		/** Whole minutes left in a cooldown, never below one. */
		function cooldownMinutesLeft(cooldownUntil, now = Date.now()) {
			return Math.max(1, Math.ceil((cooldownUntil - now) / 6e4));
		}
		/** Whether one account currently carries a live 429 cooldown. */
		function isCoolingDown(account, now = Date.now()) {
			return typeof account.cooldownUntil === "number" && account.cooldownUntil > now;
		}
		/**
		* The account-management group every provider tab renders.
		*
		* One component rather than four near-identical blocks: the account card, its
		* badges and the rotation-strategy picker are identical across providers, and
		* only the identity details differ.
		*
		* Credential storage is deliberately NOT shown here. Where the host keeps a
		* token is not a setting a user can act on, and rendering it as a labeled row
		* invited exactly that reading; several lines' notices went further and printed
		* the credential file's path.
		*/
		function AccountPoolSection(props) {
			const t = props.labels;
			const accounts = props.accounts;
			const now = Date.now();
			const anyQuota = accounts.some((account) => account.quota !== void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsha-group",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-grouphead",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [t.accountPool, accounts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsha-muted",
							style: {
								fontWeight: 400,
								marginLeft: 8
							},
							children: [
								"（",
								formatPoolLabel(t.accountCount, { count: accounts.length }),
								"）"
							]
						})] }), props.renderLoginActions !== void 0 ? props.renderLoginActions() : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsha-btn dsha-btn-primary",
							disabled: props.busy !== null,
							onClick: props.onLogin,
							children: props.loginBusyLabel || t.addAccount
						})]
					}),
					accounts.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-pref-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.rotationStrategy }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: {
								fontSize: 12,
								marginTop: 2
							},
							children: props.rotationStrategy === "round-robin" ? t.strategyRoundRobin : props.rotationStrategy === "sticky" ? t.strategySticky : props.rotationStrategy === "expiry-first" ? (t.strategyExpiryFirst || "到期优先（优先消耗最快重置的 7d / 5h 配额窗口）") : t.strategySequential
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "dsha-select",
							"aria-label": t.rotationStrategy,
							value: props.rotationStrategy,
							disabled: props.busy !== null,
							onChange: (event) => props.onSetStrategy(event.target.value),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "sequential",
									children: "顺序耗尽"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "expiry-first",
									children: "到期优先 (agy)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "round-robin",
									children: "轮询调度"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "sticky",
									children: "粘性会话"
								})
							]
						})]
					}),
					accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-empty",
						children: t.noAccounts
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-accounts-list",
						children: accounts.map((account) => {
							const isActive = account.id === props.activeAccountId;
							const cooling = isCoolingDown(account, now);
							const needsRelogin = account.authStatus !== void 0 && account.authStatus !== "ok";
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `dsha-account-card ${isActive ? "active" : ""}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-account-header",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-account-identity",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-account-title",
												children: account.alias || account.email || account.id
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-badges",
												children: [
													account.isPrimary && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsha-badge primary",
														children: t.primaryAccount
													}),
													isActive && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsha-badge active",
														children: t.activeAccount
													}),
													cooling && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dsha-badge cooldown",
														children: [
															t.cooling,
															"（",
															formatPoolLabel(t.cooldownLeft, { minutes: cooldownMinutesLeft(account.cooldownUntil, now) }),
															"）"
														]
													}),
													needsRelogin && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsha-badge danger",
														children: t.needsRelogin
													})
												]
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-account-actions",
											children: [
												props.renderAccountActions?.(account),
												!account.isPrimary && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn",
													disabled: props.busy !== null,
													onClick: () => props.onSetPrimary(account.id),
													children: t.setPrimary
												}),
												cooling && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn",
													disabled: props.busy !== null,
													onClick: () => props.onClearCooldown(account.id),
													children: t.clearCooldown
												}),
												needsRelogin && props.onRelogin && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn",
													disabled: props.busy !== null,
													onClick: () => props.onRelogin(account.id),
													children: t.relogin
												}),
												account.removable !== false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn",
													disabled: props.busy !== null,
													onClick: () => props.onDelete(account.id),
													children: t.deleteAccount
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-account-details",
										children: [
											props.renderDetails?.(account),
											account.email !== void 0 && account.email !== account.alias && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												t.email,
												": ",
												account.email
											] }),
											account.expiresAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												t.expires,
												": ",
												formatAccountDate(account.expiresAt)
											] }),
											account.lastUsedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												t.lastUsed,
												": ",
												formatAccountDate(account.lastUsedAt)
											] })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountQuota, {
										quota: account.quota,
										labels: t,
										showEmpty: props.showQuota === true || anyQuota,
										now
									}),
									needsRelogin && account.authFailedReason && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-account-details",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.authFailedReason })
									})
								]
							}, account.id);
						})
					}),
					props.children
				]
			});
		}
		//#endregion
		//#region src/client/common/ModelChecklist.tsx
		/**
		* The shared "which models appear in the picker" list every provider section
		* renders.
		*
		* The visual language follows the claude-style model picker: one row per
		* model — vendor mark, name, a single quiet hint line (context window when
		* the catalog carries one) — with the selection state drawn as a trailing
		* check dot instead of a bare checkbox. Unlike the picker this list is
		* multi-select, so rows are `role="checkbox"` and the header carries the
		* select-all / clear-all pair the old checkbox blocks had.
		*
		* One component rather than eight near-identical blocks: sections differ only
		* in where the items come from and which dictionary supplies the labels.
		*/
		const CHECK_SVG = "<svg viewBox=\"0 0 16 16\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 8.5l3.2 3.2L13 5\"/></svg>";
		function ModelChecklist({ items, busy, onToggle, onToggleAll, labels }) {
			const enabledCount = items.filter((item) => item.enabled).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-mcl",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-mcl-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-mcl-count",
						children: (labels.countTemplate ?? "{count}/{total}").replace("{count}", String(enabledCount)).replace("{total}", String(items.length))
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-mcl-head-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-mcl-action",
							disabled: busy || enabledCount === items.length,
							onClick: () => onToggleAll(true),
							children: labels.selectAll
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-mcl-action",
							disabled: busy || enabledCount === 0,
							onClick: () => onToggleAll(false),
							children: labels.clearAll
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-mcl-list",
					role: "group",
					"aria-label": labels.list,
					children: items.map((item) => {
						const mark = modelBrandMark(item.id);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "checkbox",
							"aria-checked": item.enabled,
							className: "dsh-mcl-option",
							"data-enabled": item.enabled,
							disabled: busy,
							title: item.id,
							onClick: () => onToggle(item.id, !item.enabled),
							children: [
								mark !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {
									mark,
									size: 18
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-mcl-copy",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-mcl-name",
										children: item.name
									}), item.hint !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-mcl-hint",
										children: item.hint
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-mcl-check",
									"aria-hidden": "true",
									dangerouslySetInnerHTML: { __html: item.enabled ? CHECK_SVG : "" }
								})
							]
						}, item.id);
					})
				})]
			});
		}
		//#endregion
		//#region src/client/common/quota-follow-up.ts
		/**
		* One follow-up poll after a status answer that carried a background refresh.
		*
		* The host answers a status card from the snapshot it already has and refreshes
		* the quota behind that answer, so a tab renders immediately instead of waiting
		* on the upstream request. The refreshed numbers would otherwise only appear on
		* the next 60 s poll, so an answer that reports a refresh in flight schedules
		* one short follow-up.
		*
		* The chain is bounded. A refresh that keeps failing leaves the snapshot aged,
		* so every answer would keep asking for a follow-up; after a few consecutive
		* attempts the surface falls back to its ordinary polling and stops hammering
		* the host.
		*/
		const FOLLOW_UP_DELAY_MS = 1500;
		const MAX_ATTEMPTS = 3;
		function createQuotaFollowUp(options = {}) {
			const delayMs = options.delayMs ?? FOLLOW_UP_DELAY_MS;
			const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
			let attempts = 0;
			let timer;
			return {
				observe(refreshing, reload) {
					if (!refreshing) {
						attempts = 0;
						return;
					}
					if (timer !== void 0 || attempts >= maxAttempts) return;
					attempts += 1;
					timer = setTimeout(() => {
						timer = void 0;
						reload();
					}, delayMs);
				},
				cancel() {
					if (timer !== void 0) clearTimeout(timer);
					timer = void 0;
					attempts = 0;
				}
			};
		}
		//#endregion
		//#region src/client/CodexSubscriptionSection.tsx
		function CodexSubscriptionSection({ t, onModelChange }) {
			const apiRef = (0, react.useRef)(new SubscriptionApi());
			const eventSourceRef = (0, react.useRef)(null);
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const [status, setStatus] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [authUrl, setAuthUrl] = (0, react.useState)(null);
			const [popupBlocked, setPopupBlocked] = (0, react.useState)(false);
			const [resetCreditNotice, setResetCreditNotice] = (0, react.useState)(null);
			const [connection, setConnection] = (0, react.useState)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [customProxyDraft, setCustomProxyDraft] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const next = await apiRef.current.status();
					setStatus(next);
					if (next.error !== void 0) setError(next.error.message);
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(next.quotaRefreshing === true, () => {
						load(true);
					});
				} catch (cause) {
					if (!quiet) setError(messageOf$3(cause));
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") load(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
					eventSourceRef.current?.close();
				};
			}, [load]);
			const watchLogin = (0, react.useCallback)((loginId) => {
				eventSourceRef.current?.close();
				const source = apiRef.current.events(loginId);
				eventSourceRef.current = source;
				const finish = async (message) => {
					source.close();
					eventSourceRef.current = null;
					setBusy(null);
					setAuthUrl(null);
					if (message !== void 0) setError(message);
					await load(true);
				};
				source.addEventListener("completed", (event) => {
					if (parseLoginEvent(event)?.type === "completed") finish();
				});
				source.addEventListener("cancelled", () => void finish());
				source.addEventListener("failed", (event) => {
					const parsed = parseLoginEvent(event);
					finish(parsed?.type === "failed" ? parsed.error.message : "ChatGPT sign-in failed.");
				});
			}, [load]);
			(0, react.useEffect)(() => {
				const loginId = status?.login.active ? status.login.loginId : null;
				if (loginId !== null && loginId !== void 0 && eventSourceRef.current === null) watchLogin(loginId);
			}, [
				status?.login.active,
				status?.login.loginId,
				watchLogin
			]);
			const startLogin = async () => {
				setBusy("login");
				setError(null);
				setPopupBlocked(false);
				const popup = window.open("about:blank", "dsh-chatgpt-oauth", "popup,width=560,height=760");
				try {
					const login = await apiRef.current.startLogin();
					setAuthUrl(login.authUrl);
					if (popup === null) setPopupBlocked(true);
					else popup.location.replace(login.authUrl);
					watchLogin(login.loginId);
					await load(true);
				} catch (cause) {
					popup?.close();
					setBusy(null);
					setError(messageOf$3(cause));
				}
			};
			const cancelLogin = async () => {
				const loginId = status?.login.loginId;
				if (loginId === null || loginId === void 0) return;
				setBusy("login");
				try {
					await apiRef.current.cancelLogin(loginId);
					eventSourceRef.current?.close();
					eventSourceRef.current = null;
					setAuthUrl(null);
					await load();
				} catch (cause) {
					setError(messageOf$3(cause));
				} finally {
					setBusy(null);
				}
			};
			const refreshToken = async () => run("token", async () => {
				setStatus(await apiRef.current.refresh());
			});
			const refreshQuota = async () => run("quota", async () => {
				const quota = await apiRef.current.refreshQuota();
				setStatus((current) => current === null ? current : {
					...current,
					quota
				});
			});
			const useResetCredit = async () => {
				if (!window.confirm(t("useResetCreditConfirm"))) return;
				await run("reset-credit", async () => {
					const quota = await apiRef.current.useResetCredit();
					setStatus((current) => current === null ? current : {
						...current,
						quota
					});
					setResetCreditNotice(t("resetCreditUsed"));
				});
			};
			const testConnection = async () => run("test", async () => {
				const result = await apiRef.current.testConnection();
				setConnection({
					latencyMs: result.latencyMs,
					checkedAt: result.checkedAt
				});
			});
			const refreshCatalog = async () => run("catalog", async () => {
				const next = await apiRef.current.refreshCatalog();
				setStatus((current) => current === null ? next : {
					...current,
					...next
				});
				onModelChange?.();
			});
			const updatePreferences = async (patch) => run("preferences", async () => {
				const preferences = await apiRef.current.updatePreferences(patch);
				setStatus((current) => current === null ? current : {
					...current,
					preferences
				});
				if (patch.visibleModelIds !== void 0 || patch.enabled !== void 0 || patch.contextWindowOverrides !== void 0) {
					onModelChange?.();
				}
			});
			const selectSearchProvider = (provider) => {
				setStatus((current) => current ? {
					...current,
					preferences: {
						...current.preferences,
						searchProvider: provider
					}
				} : current);
				updatePreferences({ searchProvider: provider });
			};
			const toggleVisibleModel = async (modelId, checked) => {
				const current = status?.preferences.visibleModelIds ?? [...DEFAULT_VISIBLE_CODEX_MODEL_IDS];
				const visibleModelIds = checked ? [...current, modelId] : current.filter((id) => id !== modelId);
				await updatePreferences({ visibleModelIds });
			};
			const setAllVisibleModels = async (selectAll) => {
				const visibleModelIds = selectAll ? (status?.catalogModels ?? CODEX_MODEL_CATALOG).map((m) => m.id) : [];
				await updatePreferences({ visibleModelIds });
			};
			const updateContextWindow = async (model) => {
				const current = status?.preferences.contextWindowOverrides[model] ?? resolveCodexCatalogEntry(model).contextWindow;
				const parsed = parseCapacity(contextDrafts[model] ?? String(current), contextWindowLimitForModel(model));
				if (parsed === null) {
					setError(t("contextWindowInvalid"));
					return;
				}
				await updatePreferences({ contextWindowOverrides: { [model]: parsed } });
				setContextDrafts((drafts) => ({
					...drafts,
					[model]: String(parsed)
				}));
			};
			/** Drop one model's override; the row falls back to the catalog value. */
			const resetContextWindow = async (model) => {
				await updatePreferences({ contextWindowOverrides: { [model]: null } });
				setContextDrafts((drafts) => ({
					...drafts,
					[model]: formatCapacity$1(resolveCodexCatalogEntry(model).contextWindow)
				}));
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const resetAllContextWindows = async () => {
				const models = Object.keys(status?.preferences.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (!window.confirm(t("contextWindowResetAllConfirm"))) return;
				await updatePreferences({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) });
				setContextDrafts({});
			};
			const updateCustomProxyUrl = async () => {
				const draft = customProxyDraft?.trim();
				await updatePreferences({ customProxyUrl: draft ? draft : null });
				setCustomProxyDraft(null);
			};
			/**
			* The shared card takes a label object while this tab translates by key, so
			* every pool label is resolved through the tab's own translator and follows
			* whichever locale is active.
			*/
			const poolLabels = {
				accountPool: t("accountPool"),
				addAccount: t("addAccount"),
				accountCount: t("accountCount"),
				primaryAccount: t("primaryAccount"),
				activeAccount: t("activeAccount"),
				setPrimary: t("setPrimary"),
				deleteAccount: t("deleteAccount"),
				cooling: t("cooling"),
				cooldownLeft: t("cooldownLeft"),
				clearCooldown: t("clearCooldown"),
				needsRelogin: t("needsRelogin"),
				relogin: t("relogin"),
				rotationStrategy: t("rotationStrategy"),
				strategySequential: t("strategySequential"),
				strategyRoundRobin: t("strategyRoundRobin"),
				strategySticky: t("strategySticky"),
				noAccounts: t("noAccounts"),
				email: t("email"),
				expires: t("expires"),
				lastUsed: t("lastUsed"),
				accountId: t("accountId"),
				accountQuota: t("accountQuota"),
				quotaNone: t("quotaNone"),
				quotaSnapshot: t("quotaSnapshot"),
				quotaResets: t("quotaResets"),
				quotaExhausted: t("quotaExhausted"),
				quotaWindow: t("quotaWindow"),
				quotaUsed: t("quotaUsed"),
				quotaFactsScope: t("quotaFactsScope"),
				composerLabel: t("composerLabel")
			};
			const accountAction = async (action, accountId) => {
				await run(action, async () => {
					const next = await apiRef.current.accountAction(action, { accountId });
					setStatus(next);
				});
			};
			/**
			* Forget every imported snapshot: the undo for the local sign-in import below.
			*
			* ONE control for the whole pool rather than one per row, because the host's
			* route deliberately ignores an accountId and clears every imported row at once.
			* That is not an oversight to route around: the pool refuses to delete an
			* adopted credential, so a per-row control here could only ever be a button that
			* silently clears its neighbours — a worse bug than offering no button at all.
			* The Codex CLI's own file is not deleted, rewritten or moved by this; it only
			* makes this plugin forget the copy it took.
			*/
			const stopImporting = async () => {
				await run("adopt-disable", async () => {
					setStatus(await apiRef.current.disableAdoptedLocalLogins());
				});
			};
			/**
			* Copy this machine's Codex CLI sign-in into the pool as a snapshot.
			*
			* The status is re-read rather than taken from the route's answer: the route
			* answers with the pool's refreshed status, which knows nothing about the
			* CLI file, so adopting from its value would flip the block to "not detected"
			* one click after the import succeeded. The file is still there — the import
			* copies it — so /status is the answer that tells the truth, and the row the
			* account just created comes back with it.
			*/
			const importLocalSignIn = async () => {
				await run("adopt", async () => {
					await apiRef.current.adoptLocalLogin("codex");
					await load(true);
				});
			};
			const setRotationStrategy = async (strategy) => {
				await run("strategy", async () => {
					const next = await apiRef.current.accountAction("strategy", { strategy });
					setStatus(next);
				});
			};
			/**
			* Re-authorize one account.
			*
			* The failure marker is cleared first and nothing is deleted: the account
			* keeps its alias and place in the rotation.
			*/
			const relogin = (accountId) => {
				(async () => {
					try {
						const next = await apiRef.current.accountAction("relogin", { accountId });
						setStatus(next);
					} catch (cause) {
						setError(messageOf$3(cause));
						return;
					}
					await startLogin();
				})();
			};
			const run = async (action, task) => {
				setBusy(action);
				setError(null);
				setResetCreditNotice(null);
				try {
					await task();
				} catch (cause) {
					setError(messageOf$3(cause));
				} finally {
					setBusy(null);
				}
			};
			const importedAccounts = (status?.accounts ?? []).filter((account) => account.removable === false);
			status?.account;
			const preferences = status?.preferences;
			const quota = status?.quota;
			const login = status?.login;
			const catalogModels = Array.isArray(status?.catalogModels) && status.catalogModels.length > 0 ? status.catalogModels : CODEX_MODEL_CATALOG;
			const visibleModelIds = preferences?.visibleModelIds ?? DEFAULT_VISIBLE_CODEX_MODEL_IDS;
			const contextModels = catalogModels.filter((entry) => visibleModelIds.some((id) => id === entry.id));
			const overrideCount = Object.keys(preferences?.contextWindowOverrides ?? {}).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsha-page",
				"aria-labelledby": "dsh-codex-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						id: "dsh-codex-title",
						className: "dsh-codex-title",
						children: t("title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-codex-intro",
						children: t("intro")
					})] }),
					error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-codex-errorbar",
						role: "alert",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: error }), status === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: busy !== null,
							onClick: () => load(),
							children: t("retry")
						}) : null]
					}) : null,
					status === null && error === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { label: t("loading") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
							accounts: status?.accounts ?? [],
							activeAccountId: status?.activeAccountId,
							rotationStrategy: status?.rotationStrategy ?? "sequential",
							busy,
							labels: poolLabels,
							loginBusyLabel: login?.active ? t("pending") : void 0,
							onLogin: () => void startLogin(),
							onSetPrimary: (accountId) => void accountAction("set-primary", accountId),
							onDelete: (accountId) => void accountAction("delete", accountId),
							onClearCooldown: (accountId) => void accountAction("clear-cooldown", accountId),
							onRelogin: (accountId) => relogin(accountId),
							onSetStrategy: (strategy) => void setRotationStrategy(strategy),
							showQuota: true,
							renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-account-add-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn dsha-btn-primary",
									disabled: busy !== null,
									onClick: () => void startLogin(),
									children: login?.active ? t("pending") : t("addAccount")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									"aria-label": t("localCodexLoginImport"),
									onClick: () => void importLocalSignIn(),
									children: busy === "adopt" ? t("localCodexLoginImporting") : t("localCodexLoginImport")
								})]
							}),
							renderDetails: (entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: entry.planLabel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("plan"),
								": ",
								entry.planLabel
							] }) }),
							children: [
								login?.active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									role: "status",
									children: t("pending")
								}) : null,
								popupBlocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-error",
									children: t("popupBlocked")
								}) : null,
								authUrl !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: "dsh-codex-link",
									href: authUrl,
									target: "_blank",
									rel: "noreferrer",
									children: t("continueLogin")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-actions",
									children: [login?.active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										disabled: busy !== null,
										onClick: cancelLogin,
										children: t("cancel")
									}) : null, status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										disabled: busy !== null,
										onClick: refreshToken,
										children: t("refreshToken")
									}) : null]
								}),
								importedAccounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: formatPoolLabel(t("stopImportingHint"), { count: importedAccounts.length })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsha-actions",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										type: "button",
										disabled: busy !== null,
										"aria-label": formatPoolLabel(t("stopImportingLabel"), { count: importedAccounts.length }),
										onClick: () => void stopImporting(),
										children: busy === "adopt-disable" ? t("stopImportingBusy") : t("stopImporting")
									})
								})] }) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
							title: t("connection"),
							aside: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								disabled: !status?.authenticated || busy !== null,
								onClick: refreshCatalog,
								children: busy === "catalog" ? t("refreshingCatalog") : t("refreshCatalog")
							}),
							children: [
								connection !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
									label: t("latency"),
									value: `${connection.latencyMs} ms · ${formatDate$1(connection.checkedAt)}`
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted dsha-models-hint",
									children: t("modelsHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
									items: catalogModels.map((model) => ({
										id: model.id,
										name: model.name,
										hint: `${formatCapacity$1(model.contextWindow)} ${t("tokens")}`,
										enabled: visibleModelIds.some((id) => id === model.id)
									})),
									busy: busy !== null,
									onToggle: (id, enabled) => void toggleVisibleModel(id, enabled),
									onToggleAll: (enabled) => void setAllVisibleModels(enabled),
									labels: {
										selectAll: t("selectAll"),
										clearAll: t("unselectAll"),
										countTemplate: t("modelChecklistCount"),
										list: t("models")
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsha-actions",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										disabled: !status?.authenticated || busy !== null,
										onClick: testConnection,
										children: busy === "test" ? t("testing") : t("testConnection")
									})
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
							title: t("proxySettings"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-pref-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("proxyMode") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("proxyModeHint")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dsha-select",
										"aria-label": t("proxyMode"),
										value: preferences?.proxyMode ?? "auto",
										disabled: busy !== null,
										onChange: (event) => {
											const mode = event.currentTarget.value;
											setStatus((current) => current ? {
												...current,
												preferences: {
													...current.preferences,
													proxyMode: mode
												}
											} : current);
											updatePreferences({ proxyMode: mode });
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "auto",
												children: t("proxyModeAuto")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "custom",
												children: t("proxyModeCustom")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "direct",
												children: t("proxyModeDirect")
											})
										]
									})]
								}),
								(preferences?.proxyMode ?? "auto") === "auto" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-codex-proxy-status",
									children: status?.detectedProxy ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("proxyDetected"), ":"] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											className: "dsh-codex-proxy-tag",
											children: status.detectedProxy
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-codex-success",
											children: t("proxyDetectedEffective")
										})
									] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-muted",
										children: t("proxyNoneDetected")
									})
								}) : null,
								preferences?.proxyMode === "direct" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									style: { margin: "8px 0 0" },
									children: t("proxyDirectHint")
								}) : null,
								preferences?.proxyMode === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-context-settings",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("customProxyUrl") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("customProxyUrlHint")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-context-row",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsh-codex-proxy-control",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												id: "dsh-codex-custom-proxy",
												type: "text",
												placeholder: t("customProxyUrlPlaceholder"),
												value: customProxyDraft ?? preferences?.customProxyUrl ?? "",
												disabled: busy !== null,
												"aria-label": t("customProxyUrl"),
												onChange: (event) => {
													setCustomProxyDraft(event.currentTarget.value);
												},
												onKeyDown: (event) => {
													if (event.key !== "Enter") return;
													event.preventDefault();
													updateCustomProxyUrl();
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-context-save",
												type: "button",
												"aria-label": t("saveProxyUrl"),
												disabled: busy !== null || customProxyDraft === null,
												onClick: () => void updateCustomProxyUrl(),
												children: t("save")
											})]
										})
									})]
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
							title: t("enhancements"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-pref-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("searchProvider") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("searchProviderHint")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-codex-segments",
										role: "group",
										"aria-label": t("searchProvider"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: preferences?.searchProvider === "dsh" ? "active" : "",
											"aria-pressed": preferences?.searchProvider === "dsh",
											disabled: busy !== null,
											onClick: () => selectSearchProvider("dsh"),
											children: t("searchProviderDsh")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: preferences?.searchProvider === "codex" ? "active" : "",
											"aria-pressed": preferences?.searchProvider === "codex",
											disabled: busy !== null,
											onClick: () => selectSearchProvider("codex"),
											children: t("searchProviderCodex")
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FetchProviderStatusCard, {
									status,
									t
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-pref-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("outputVerbosity") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("outputVerbosityHint")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dsha-select",
										"aria-label": t("outputVerbosity"),
										value: preferences?.outputVerbosity ?? "",
										disabled: busy !== null,
										onChange: (event) => {
											const value = event.currentTarget.value;
											updatePreferences({ outputVerbosity: value === "" ? null : value });
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "",
												children: t("providerDefault")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "low",
												children: t("verbosityLow")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "medium",
												children: t("verbosityMedium")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "high",
												children: t("verbosityHigh")
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-pref-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("reasoningSummary") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("reasoningSummaryHint")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dsha-select",
										"aria-label": t("reasoningSummary"),
										value: preferences?.reasoningSummary ?? "",
										disabled: busy !== null,
										onChange: (event) => {
											const value = event.currentTarget.value;
											updatePreferences({ reasoningSummary: value === "" ? null : value });
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "",
												children: t("providerDefault")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "auto",
												children: t("summaryAuto")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "concise",
												children: t("summaryConcise")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "detailed",
												children: t("summaryDetailed")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "none",
												children: t("summaryNone")
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-context-settings",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("contextWindows") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t("contextWindowsHint")
										})] }),
										contextModels.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t("contextWindowsNoneEnabled")
										}) : null,
										contextModels.map((entry) => {
											const model = entry.id;
											const fallback = preferences?.contextWindowOverrides?.[model] ?? entry.contextWindow;
											const draft = contextDrafts[model];
											const parsedDraft = draft === void 0 ? fallback : parseCapacity(draft, contextWindowLimitForModel(model));
											const dirty = draft !== void 0 && parsedDraft !== fallback;
											const overridden = preferences?.contextWindowOverrides?.[model] !== void 0;
											const inputId = `dsh-codex-context-${model}`;
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-context-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: inputId,
													children: entry.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsha-capacity-control",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															id: inputId,
															type: "text",
															inputMode: "numeric",
															value: draft ?? formatCapacity$1(fallback),
															disabled: busy !== null,
															"aria-label": entry.name + " " + t("contextWindow"),
															onChange: (event) => {
																const value = event.currentTarget.value;
																setContextDrafts((drafts) => ({
																	...drafts,
																	[model]: value
																}));
															},
															onKeyDown: (event) => {
																if (event.key !== "Enter" || !dirty) return;
																event.preventDefault();
																updateContextWindow(model);
															}
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("tokens") }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "dsha-context-save",
															type: "button",
															"data-model": model,
															"aria-label": entry.name + " " + t("saveContextWindow"),
															disabled: busy !== null || !dirty,
															onClick: () => void updateContextWindow(model),
															children: t("save")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "dsha-context-save dsha-context-reset",
															type: "button",
															"data-reset-model": model,
															"aria-label": entry.name + " " + t("contextWindowReset"),
															disabled: busy !== null || !overridden,
															onClick: () => void resetContextWindow(model),
															children: t("contextWindowReset")
														})
													]
												})]
											}, model);
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsha-actions",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
												disabled: busy !== null || overrideCount === 0,
												onClick: resetAllContextWindows,
												children: t("contextWindowResetAll")
											})
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-codex-check",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: preferences?.fastMode === true,
										disabled: busy !== null,
										onChange: (event) => updatePreferences({ fastMode: event.currentTarget.checked })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("fastMode") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("fastModeHint") })] })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-codex-check",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: preferences?.quickQuotaVisible === true,
										disabled: busy !== null,
										onChange: (event) => updatePreferences({ quickQuotaVisible: event.currentTarget.checked })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("quickQuota") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("quickQuotaHint") })] })]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
							title: t("quota"),
							aside: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								disabled: !status?.authenticated || busy !== null,
								onClick: refreshQuota,
								children: busy === "quota" ? t("refreshing") : t("refreshQuota")
							}),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t("quotaIntro")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: poolLabels.quotaFactsScope
								}),
								quota?.state === "signed-out" || !status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-empty",
									children: t("quotaSignedOut")
								}) : null,
								quota?.buckets?.map((bucket) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaFact, {
									label: bucket.name,
									value: bucket.planType ?? "—"
								}, bucket.id)),
								quota?.credits !== null && quota?.credits !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaFact, {
									label: t("credits"),
									value: quota.credits.unlimited ? t("unlimited") : quota.credits.balance ?? (quota.credits.hasCredits ? t("available") : t("unavailable"))
								}) : null,
								quota?.individualLimit !== null && quota?.individualLimit !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaFact, {
									label: t("monthlySpend"),
									value: individualLimitLabel(quota.individualLimit, t)
								}) : null,
								quota?.resetCredits !== null && quota?.resetCredits !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResetCreditsFact, {
									resetCredits: quota.resetCredits,
									busy,
									onUse: useResetCredit,
									t
								}) : null,
								resetCreditNotice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-success",
									role: "status",
									children: resetCreditNotice
								}) : null,
								quota?.spendControlReached === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-warning",
									role: "status",
									children: t("spendControlReached")
								}) : null,
								quota?.state === "empty" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-empty",
									children: t("noQuota")
								}) : null,
								quota?.stale ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-warning",
									role: "status",
									children: t("stale")
								}) : null,
								quota?.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-codex-error",
									role: "alert",
									children: quota.error.message
								}) : null,
								quota?.fetchedAt ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "dsh-codex-timestamp",
									children: [
										t("updated"),
										": ",
										formatDate$1(quota.fetchedAt)
									]
								}) : null
							]
						})
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-codex-sr",
						"aria-live": "polite",
						children: busy === null ? "" : busy
					})
				]
			});
		}
		function Section({ title, aside, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsha-group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsha-grouphead",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: title }), aside]
				}), children]
			});
		}
		function Button({ primary = false, disabled, onClick, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				className: `dsha-btn${primary ? " dsha-btn-primary" : ""}`,
				type: "button",
				disabled,
				onClick: () => void onClick(),
				children
			});
		}
		function InfoRow({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsha-label",
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsha-value",
					children: value
				})]
			});
		}
		const SWITCHER_STATE_LABELS = {
			idle: "switcherStateIdle",
			applying: "switcherStateApplying",
			applied: "switcherStateApplied",
			missing: "switcherStateMissing",
			failed: "switcherStateFailed"
		};
		const FETCH_MODE_LABELS = {
			auto: "fetchModeAuto",
			plugin: "fetchModePlugin",
			dsh: "fetchModeDsh"
		};
		/**
		* Read-only view of the fetch selection, shown under the search source.
		*
		* Both blocks are optional on the status DTO, so every row is rendered only from
		* a value the host actually reported. That distinction is load-bearing: a
		* missing `switcher` means the host tells us nothing and the row stays hidden,
		* while a reported `configuredFetchProvider: null` is a real answer — the host
		* pinned no provider, which is the DSH default. Guessing an id there would claim
		* a provider the settings page never observed.
		*
		* Nothing here is editable: the mode and the limits live in the plugin Config,
		* not in the preferences this card sits in, so the numbers cannot be mistaken for
		* a setting that this page can change.
		*/
		function FetchProviderStatusCard({ status, t }) {
			const switcher = status?.switcher;
			const configuration = status?.fetchConfiguration;
			if (switcher === void 0 && configuration === void 0) return null;
			const state = switcher !== null && switcher !== void 0 && switcher.state in SWITCHER_STATE_LABELS ? switcher.state : null;
			const mode = configuration !== void 0 && configuration.fetchProvider in FETCH_MODE_LABELS ? configuration.fetchProvider : void 0;
			const maxBodyChars = fetchLimit(configuration?.fetchMaxBodyChars);
			const maxResponseBytes = fetchLimit(configuration?.fetchMaxResponseBytes);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-context-settings",
				"data-fetch-status": state ?? "none",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("fetchStatus") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t("fetchStatusHint")
					})] }),
					switcher !== null && switcher !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
						label: t("fetchConfiguredProvider"),
						value: switcher.configuredFetchProvider || t("fetchProviderDshDefault")
					}) : null,
					state !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
						label: t("switcherState"),
						value: t(SWITCHER_STATE_LABELS[state])
					}) : null,
					mode !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
						label: t("fetchMode"),
						value: t(FETCH_MODE_LABELS[mode])
					}) : null,
					maxBodyChars !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
						label: t("fetchMaxBodyChars"),
						value: `${maxBodyChars} ${t("characters")}`
					}) : null,
					maxResponseBytes !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoRow, {
						label: t("fetchMaxResponseBytes"),
						value: `${maxResponseBytes} ${t("bytes")}`
					}) : null,
					mode !== void 0 && mode !== "plugin" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t("fetchLimitsInactive")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t("fetchConfigSource")
					})
				]
			});
		}
		/** A limit is shown only once it is the positive safe integer the Config promises. */
		function fetchLimit(value) {
			return value !== void 0 && Number.isSafeInteger(value) && value >= 1 ? value : null;
		}
		function QuotaFact({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-codex-quota-fact",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: value })]
			});
		}
		function ResetCreditsFact({ resetCredits, busy, onUse, t }) {
			const available = resetCredits.availableCount > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-codex-reset-credits",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-codex-reset-credits-info",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("resetCredits") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: resetCredits.availableCount }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
							t("resetCreditExpires"),
							": ",
							resetCredits.expiresAt == null ? t("unknown") : formatReset$1(resetCredits.expiresAt)
						] })
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					primary: true,
					disabled: !available || busy !== null,
					onClick: onUse,
					children: busy === "reset-credit" ? t("usingResetCredit") : t("useResetCredit")
				})]
			});
		}
		function Skeleton({ label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-codex-skeleton",
				role: "status",
				"aria-label": label,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})]
			});
		}
		function parsePositiveCapacity$1(value) {
			const matched = value.trim().toLowerCase().replace(/[,_\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/);
			if (matched === null) return null;
			const multiplier = matched[2] === "m" ? 1e6 : matched[2] === "k" ? 1e3 : 1;
			const parsed = Number(matched[1]) * multiplier;
			return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
		}
		function parseCapacity(value, maxContextWindow = GPT_56_MAX_CONTEXT_WINDOW) {
			const parsed = parsePositiveCapacity$1(value);
			return parsed !== null && parsed <= maxContextWindow ? parsed : null;
		}
		function formatCapacity$1(value) {
			if (value % 1e3 === 0) return `${value / 1e3}K`;
			return String(value);
		}
		function formatPercent(value) {
			if (value === void 0 || value === null || typeof value !== "number" || !Number.isFinite(value)) return "0%";
			try {
				return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value)}%`;
			} catch {
				return `${value}%`;
			}
		}
		function individualLimitLabel(limit, t) {
			const parts = [
				limit.remainingPercent !== null && limit.remainingPercent !== void 0 ? `${formatPercent(limit.remainingPercent)} ${t("remaining")}` : null,
				limit.limit !== null && limit.limit !== void 0 ? `${t("limit")}: ${limit.limit}` : null,
				limit.used !== null && limit.used !== void 0 ? `${t("used")}: ${limit.used}` : null,
				limit.resetsAt !== null && limit.resetsAt !== void 0 ? `${t("resets")}: ${formatReset$1(limit.resetsAt)}` : null
			].filter((part) => part !== null);
			return parts.length > 0 ? parts.join(" · ") : t("unknown");
		}
		function formatDate$1(seconds) {
			if (seconds === void 0 || seconds === null || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
			const ms = seconds > 1e10 ? seconds : seconds * 1e3;
			try {
				return new Intl.DateTimeFormat(void 0, {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(ms);
			} catch {
				return "—";
			}
		}
		function formatReset$1(seconds) {
			if (seconds === void 0 || seconds === null || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
			const ms = seconds > 1e10 ? seconds : seconds * 1e3;
			const absolute = formatDate$1(seconds);
			const diff = ms - Date.now();
			const abs = Math.abs(diff);
			const [amount, unit] = abs >= 864e5 ? [Math.round(diff / 864e5), "day"] : abs >= 36e5 ? [Math.round(diff / 36e5), "hour"] : [Math.round(diff / 6e4), "minute"];
			try {
				return `${absolute} (${new Intl.RelativeTimeFormat(void 0, { numeric: "auto" }).format(amount, unit)})`;
			} catch {
				return absolute;
			}
		}
		function messageOf$3(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region src/client/common/format.ts
		/**
		* The capacity, date and countdown formatting every provider settings card shares.
		*
		* Each card used to carry its own copy of the capacity pair. The five copies
		* were byte-identical except Antigravity's `formatCapacity`, which had lost the
		* 1K floor and so rendered a zero as "0K" while its siblings rendered "0". The
		* parse has to mean the same thing on every line — it takes free-text user input
		* that feeds the overflow judgement — so this is the one place it lives. The
		* date helpers were copied the same way; WorkBuddy's countdown is here for the
		* same reason.
		*/
		/**
		* Parse "1M", "512K", "200000" into a positive integer token count.
		*
		* Anything that is not a plain capacity — including `0`, which no model has —
		* returns null rather than a coerced number, so the caller can leave the draft
		* uncommitted instead of storing a length that would silently break compaction.
		*/
		function parsePositiveCapacity(value) {
			const matched = value.trim().toLowerCase().replace(/[,_\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/);
			if (matched === null) return null;
			const multiplier = matched[2] === "m" ? 1e6 : matched[2] === "k" ? 1e3 : 1;
			const parsed = Number(matched[1]) * multiplier;
			return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
		}
		/** Render a token capacity the way the capacity field seeds itself. */
		function formatCapacity(value) {
			if (value >= 1e6 && value % 1e5 === 0) return `${value / 1e6}M`;
			if (value >= 1e3 && value % 1e3 === 0) return `${value / 1e3}K`;
			return String(value);
		}
		/** A stamp in the reader's own locale, or an em dash when there is none. */
		function formatDate(ms) {
			if (ms === void 0 || ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
			try {
				return new Intl.DateTimeFormat(void 0, {
					dateStyle: "medium",
					timeStyle: "short"
				}).format(ms);
			} catch {
				return "—";
			}
		}
		/**
		* Countdown to a reset instant ("3d 4h"), empty when there is nothing to count
		* down to. Empty rather than "—" because callers append it to a date they have
		* already rendered, and a dash there would read as a second missing value.
		*/
		function formatReset(resetsAt) {
			if (resetsAt === void 0 || resetsAt === null || resetsAt <= 0) return "";
			const diff = resetsAt - Date.now();
			if (diff <= 0) return "now";
			const mins = Math.floor(diff / 6e4);
			const hours = Math.floor(mins / 60);
			const days = Math.floor(hours / 24);
			if (days > 0) return `${days}d ${hours % 24}h`;
			if (hours > 0) return `${hours}h ${mins % 60}m`;
			return `${mins}m`;
		}
		//#endregion
		//#region src/client/common/ContextWindowEditor.tsx
		/**
		* The shared "model context windows" block every provider settings card renders.
		*
		* Six cards had grown near-identical copies of this markup: one row per enabled
		* model, a free-text capacity input, a save button, a restore button, and a
		* batch restore. Only these things ever differed between them —
		*
		*   - the words (each card's dictionary, plus WorkBuddy's hardcoded `tokens`
		*     and the hardcoded English `context window` input label four of them carry);
		*   - whether a row shows the model's effective window beside the name when it
		*     exceeds the model's default, and which stylesheet class that figure wears;
		*   - whether the capacity input carries an `aria-label` at all (Antigravity's
		*     does not);
		*   - how a save or a restore is carried out, which stays in each card because
		*     WorkBuddy normalizes its status payload and Antigravity confirms the batch
		*     restore first.
		*
		* Everything the rows and callbacks need is therefore the whole interface: the
		* editor parses, seeds and stores nothing.
		*/
		/**
		* Seed one draft per model from a status payload, so the input shows the stored
		* override and falls back to the catalog length.
		*
		* Run after a model toggle too: a model that was just enabled has no draft yet,
		* and only enabled models get a row — without this, its row would render an
		* empty input that a save would then reject as unparsable.
		*/
		function contextDraftsFor(status) {
			const drafts = {};
			for (const model of status.models) drafts[model.id] = formatCapacity(status.contextWindowOverrides[model.id] || model.defaultContextWindow);
			return drafts;
		}
		function ContextWindowEditor({ rows, labels, busy, overrideCount, metaClassName, onDraftChange, onCommit, onReset, onResetAll }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-context-settings",
				children: [
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: labels.empty
					}) : null,
					rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-context-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							title: row.id,
							children: [row.name, row.meta !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: metaClassName,
								children: row.meta
							}) : null]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-capacity-control",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "text",
									"aria-label": row.inputLabel,
									value: row.draft,
									onChange: (event) => onDraftChange(row.id, event.currentTarget.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") onCommit(row.id);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: labels.tokens }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-context-save",
									disabled: row.saving,
									onClick: () => onCommit(row.id),
									children: row.saving ? labels.saving : labels.save
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-context-save dsha-context-reset",
									"aria-label": `${row.name} ${labels.reset}`,
									disabled: row.saving || !row.hasOverride,
									onClick: () => onReset(row.id),
									children: labels.reset
								})
							]
						})]
					}, row.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsha-btn",
							disabled: busy || overrideCount === 0,
							onClick: onResetAll,
							children: labels.resetAll
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/common/line-api.ts
		/**
		* A route's error field is a plain string on some routes and a structured
		* `PublicErrorDto` on others; the card must not care which one arrived.
		*/
		function errorMessage(value, fallback) {
			if (typeof value === "string" && value !== "") return value;
			if (value !== null && typeof value === "object") {
				const message = value.message;
				if (typeof message === "string" && message !== "") return message;
			}
			return fallback;
		}
		function createLineApi(prefix, label) {
			async function request(path, init) {
				const response = await fetch(`${prefix}${path}`, {
					...init,
					credentials: "same-origin",
					headers: {
						"Content-Type": "application/json",
						...init?.headers
					}
				});
				const raw = await response.text();
				if (raw.trim() === "") throw new Error(`${label} settings route did not answer (HTTP ${response.status} ${response.statusText || "no body"}). The plugin loaded in the browser may be newer than the one running in the host — restart DSH so both halves come from the same build.`);
				let body = null;
				try {
					body = JSON.parse(raw);
				} catch {
					throw new Error(`${label} settings route returned a non-JSON body (HTTP ${response.status}): ${raw.slice(0, 200)}`);
				}
				const envelope = body;
				if (envelope !== null && typeof envelope === "object" && typeof envelope.ok === "boolean") {
					if (!response.ok || envelope.ok === false) throw new Error(errorMessage(envelope.error, `HTTP ${response.status}`));
					return envelope.value;
				}
				if (!response.ok) throw new Error(errorMessage(envelope?.error, `HTTP ${response.status}`));
				return body;
			}
			return {
				request,
				get: (path) => request(path),
				post: (path, body = {}) => request(path, {
					method: "POST",
					body: JSON.stringify(body)
				})
			};
		}
		//#endregion
		//#region src/client/antigravity/locales.ts
		const NS_ANTIGRAVITY = "dsh-antigravity";
		const zh$10 = {
			...accountPoolZh,
			title: "Antigravity",
			pageDesc: "登录 Google Antigravity / Cloud Code Assist，并查看当前账号的共享额度。",
			account: "已登录",
			signedIn: "已登录",
			signedOut: "未登录",
			accountPool: "账号管理",
			addAccount: "添加账号",
			primaryAccount: "主账号",
			activeAccount: "当前使用",
			setPrimary: "设为主账号",
			deleteAccount: "删除",
			cooling: "冷却中",
			clearCooldown: "重置冷却",
			rotationStrategy: "调度策略",
			strategySequential: "顺序耗尽（当前优先，遇限流自动切号）",
			strategyRoundRobin: "轮询调度（按账号循环均匀分摊）",
			strategySticky: "会话粘性（保持当前账号直到被限流）",
			noAccounts: "暂无账号，点击「添加账号」完成登录授权。",
			plan: "套餐",
			accountId: "账号 ID",
			expires: "令牌到期",
			signInAgain: "重新登录",
			refreshToken: "刷新凭据",
			refreshingToken: "正在刷新凭据…",
			refreshTokenSuccess: "凭据刷新成功",
			refreshTokenFailed: "凭据刷新失败，请稍后重试。",
			refreshTokenNetworkError: "无法连接 Antigravity 授权服务，请稍后重试。",
			refreshTokenInvalidGrant: "Antigravity 授权已失效，请重新登录该账号。",
			refreshTokenMissing: "该账号缺少刷新凭证，请重新登录。",
			refreshTokenInvalidAccount: "请指定有效的 Antigravity 账号。",
			refreshTokenAccountNotFound: "找不到指定的 Antigravity 账号。",
			refreshTokenCrossOrigin: "不允许跨来源操作。",
			refreshTokenInvalidResponse: "Antigravity 授权服务返回了无效凭据，请稍后重试。",
			signOut: "注销",
			signIn: "登录",
			signingIn: "登录中...",
			connection: "连接",
			modelsHint: "勾选后模型才会显示在对话页的模型选择列表中；全部取消勾选或关闭概览卡片上的开关可在列表中隐藏该供应商。",
			modelsSection: "模型",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			selectAll: "全选",
			unselectAll: "全不选",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考深度",
			defaultReasoningEffortHint: "控制支持推理的模型在未单独指定时的思考强度。",
			defaultEffortAuto: "使用 Provider 默认值",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认按模型标准；可选应用最高容量，该值用于 DSH 的压缩与溢出判断，可输入 1M、512K、200K 等容量。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			save: "保存",
			saved: "已保存",
			saving: "保存中...",
			cacheSection: "缓存",
			cacheDesc: "Antigravity 的缓存由服务端隐式命中，客户端不发送任何缓存控制字段，因此这里用实际读缓存的比例反映效果。下面只报「整段未命中」的那一次，并给出它之前的空闲时长——缓存是按空闲时间过期的，而每次新对话都必然改变内容，把每次变化都报出来等于什么都没说。统计只保存在内存中，并按会话隔离。",
			cacheEmpty: "本进程还没有带用量回报的请求。",
			cacheHitRatio: "缓存命中率",
			cacheCached: "命中 tokens",
			cacheFresh: "新增 tokens",
			cacheRequests: "请求数",
			cacheMiss: "最近一次整段未命中",
			cacheMissIdle: "未命中前空闲",
			cacheDriftNone: "前缀未变化",
			cacheDriftContents: "对话内容变化",
			cacheDriftSystemInstruction: "系统指令变化",
			cacheDriftTools: "工具列表变化",
			cacheDriftSessionId: "会话标识变化",
			cacheDriftNewSession: "本次会话的首次请求",
			quotaSection: "用量与配额",
			quotaDesc: "数据来自 Google Cloud Code Assist 配额服务，页面可见时最多每 60 秒刷新一次。",
			refreshQuota: "刷新用量",
			refreshingQuota: "刷新中...",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			googleValidation: "前往 Google 完成账号验证",
			resetPrefix: "重置: {time}",
			resetUnavailable: "重置: n/a",
			resetNow: "现在",
			timeDayHour: "{days}天 {hours}时",
			timeHourMin: "{hours}h {minutes}m",
			timeMin: "{minutes}m",
			updatedAt: "更新时间：{time}",
			loading: "加载中...",
			loginFailed: "登录失败",
			tokens: "tokens"
		};
		const en$10 = {
			...accountPoolEn,
			title: "Antigravity",
			pageDesc: "Sign in to Google Antigravity / Cloud Code Assist and view shared quotas.",
			account: "Signed in",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			accountPool: "Account Management",
			addAccount: "Add Account",
			primaryAccount: "Primary",
			activeAccount: "In Use",
			setPrimary: "Set as Primary",
			deleteAccount: "Delete",
			cooling: "In Cooldown",
			clearCooldown: "Clear Cooldown",
			rotationStrategy: "Scheduling Strategy",
			strategySequential: "Sequential Drain (Primary first, failover on 429)",
			strategyRoundRobin: "Round-Robin (Evenly rotate across accounts)",
			strategySticky: "Sticky session (hold the current account until it is limited)",
			noAccounts: "No accounts yet. Click \"Add Account\" to authorize.",
			plan: "Plan",
			accountId: "Account ID",
			expires: "Token expires",
			signInAgain: "Sign in again",
			refreshToken: "Refresh credentials",
			refreshingToken: "Refreshing credentials…",
			refreshTokenSuccess: "Credentials refreshed",
			refreshTokenFailed: "Credential refresh failed. Please try again later.",
			refreshTokenNetworkError: "Could not reach the Antigravity authorization service. Please try again later.",
			refreshTokenInvalidGrant: "Antigravity authorization has expired. Please sign in to this account again.",
			refreshTokenMissing: "This account has no refresh credential. Please sign in again.",
			refreshTokenInvalidAccount: "Please select a valid Antigravity account.",
			refreshTokenAccountNotFound: "The selected Antigravity account could not be found.",
			refreshTokenCrossOrigin: "Cross-origin operations are not allowed.",
			refreshTokenInvalidResponse: "The Antigravity authorization service returned an invalid credential. Please try again later.",
			signOut: "Sign out",
			signIn: "Sign in",
			signingIn: "Signing in...",
			connection: "Connection",
			modelsHint: "Checked models will appear in DSH conversation model list; unchecking all or turning off the switch on the overview card hides this provider.",
			modelsSection: "Models",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			enhanced: "Enhanced Features",
			defaultReasoningEffort: "Default reasoning effort",
			defaultReasoningEffortHint: "Controls reasoning effort for reasoning models when not explicitly specified in conversation.",
			defaultEffortAuto: "Use Provider default",
			contextWindowSection: "Model Context Window",
			contextWindowHint: "Defaults to model specification; configure custom capacity used by DSH for compaction and overflow judgments (e.g., 1M, 512K, 200K).",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			save: "Save",
			saved: "Saved",
			saving: "Saving...",
			cacheSection: "Cache",
			cacheDesc: "Antigravity's cache is matched implicitly by the service — the client sends no cache-control field — so the served-from-cache share is the only evidence it is working. Only a total miss is reported below, beside how long the client had been idle: the cache expires on idle time, and every new turn changes the conversation, so reporting each change would report the same thing every time. The totals are in-memory and scoped per session.",
			cacheEmpty: "No request in this process has reported usage yet.",
			cacheHitRatio: "Cache hit ratio",
			cacheCached: "Cached tokens",
			cacheFresh: "Fresh tokens",
			cacheRequests: "Requests",
			cacheMiss: "Last total miss",
			cacheMissIdle: "Idle before that miss",
			cacheDriftNone: "Prefix unchanged",
			cacheDriftContents: "Conversation contents changed",
			cacheDriftSystemInstruction: "System instruction changed",
			cacheDriftTools: "Tool list changed",
			cacheDriftSessionId: "Session identifier changed",
			cacheDriftNewSession: "This session's first request",
			quotaSection: "Usage & Quota",
			quotaDesc: "Data from Google Cloud Code Assist quota service; refreshes up to once every 60 seconds when visible.",
			refreshQuota: "Refresh quota",
			refreshingQuota: "Refreshing...",
			quotaEmpty: "No quota data yet — use “Refresh quota” to retry.",
			googleValidation: "Verify the account with Google",
			resetPrefix: "Reset: {time}",
			resetUnavailable: "Reset: n/a",
			resetNow: "now",
			timeDayHour: "{days}d {hours}h",
			timeHourMin: "{hours}h {minutes}m",
			timeMin: "{minutes}m",
			updatedAt: "Updated at: {time}",
			loading: "Loading...",
			loginFailed: "Login failed",
			tokens: "tokens"
		};
		const dictionaries$10 = {
			zh: zh$10,
			"zh-CN": zh$10,
			en: en$10,
			"en-US": en$10
		};
		//#endregion
		//#region src/client/antigravity/AntigravitySection.tsx
		const api$13 = createLineApi("/wb/antigravity/api", "Antigravity");
		/** A gap in human units, so the idle reading is legible without arithmetic. */
		function idleLabel(ms) {
			const seconds = Math.round(ms / 1e3);
			if (seconds < 60) return `${seconds}s`;
			const minutes = Math.floor(seconds / 60);
			const rest = seconds % 60;
			return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
		}
		/** Human label for the cause of the last request that lost the whole cache. */
		function missLabel(cause, t) {
			switch (cause) {
				case "none": return t.cacheDriftNone;
				case "contents": return t.cacheDriftContents;
				case "systemInstruction": return t.cacheDriftSystemInstruction;
				case "tools": return t.cacheDriftTools;
				case "session-id": return t.cacheDriftSessionId;
				case "new-session": return t.cacheDriftNewSession;
				default: return String(cause);
			}
		}
		function AntigravitySection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [validationUrl, setValidationUrl] = (0, react.useState)(null);
			const [loginProgress, setLoginProgress] = (0, react.useState)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [credentialResult, setCredentialResult] = (0, react.useState)(null);
			const credentialRefreshInFlight = (0, react.useRef)(false);
			const credentialGeneration = (0, react.useRef)(0);
			const statusRevision = (0, react.useRef)(0);
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const t = zh$10;
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) {
					setError(null);
					setValidationUrl(null);
				}
				const generation = credentialGeneration.current;
				try {
					const data = await api$13.request("/status");
					if (generation !== credentialGeneration.current) return;
					statusRevision.current++;
					setStatus(data);
					setContextDrafts(contextDraftsFor(data));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(data.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (err) {
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			const handleLogin = async () => {
				try {
					setBusy("login");
					setError(null);
					setValidationUrl(null);
					setLoginProgress(null);
					const flow = await api$13.request("/login", { method: "POST" });
					if (flow.authUrl) window.open(flow.authUrl, "_blank");
					const pollTimer = setInterval(async () => {
						try {
							const pollStatus = await api$13.request("/login/status");
							if (pollStatus.progress) setLoginProgress(pollStatus.progress);
							if (pollStatus.status === "complete") {
								clearInterval(pollTimer);
								setBusy(null);
								setLoginProgress(null);
								await loadStatus();
								notifyChange();
							} else if (pollStatus.status === "error") {
								clearInterval(pollTimer);
								setBusy(null);
								setLoginProgress(null);
								setError(pollStatus.error || t.loginFailed);
								if (pollStatus.validationUrl) setValidationUrl(pollStatus.validationUrl);
							}
						} catch {}
					}, 1500);
					setTimeout(() => {
						clearInterval(pollTimer);
						setBusy(null);
						setLoginProgress(null);
					}, 300 * 1e3);
				} catch (err) {
					setBusy(null);
					setLoginProgress(null);
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleRefreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					const updated = await api$13.request("/quota", { method: "POST" });
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleRefreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					const updated = await api$13.request("/catalog/refresh", { method: "POST" });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleRefreshCredential = async (accountId) => {
				if (credentialRefreshInFlight.current || busy !== null) return;
				credentialRefreshInFlight.current = true;
				credentialGeneration.current++;
				const revision = statusRevision.current;
				setBusy(`credential-${accountId}`);
				setCredentialResult(null);
				setError(null);
				setValidationUrl(null);
				try {
					const response = await fetch("/wb/antigravity/api/accounts", {
						method: "POST",
						credentials: "same-origin",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "refresh-credential", accountId })
					}).catch(() => null);
					if (response === null) {
						setCredentialResult({ accountId, failed: true, message: t.refreshTokenNetworkError });
						return;
					}
					const body = await response.json();
					if (!response.ok || body?.ok !== true) {
						const messages = {
							INVALID_ACCOUNT_ID: t.refreshTokenInvalidAccount,
							ACCOUNT_NOT_FOUND: t.refreshTokenAccountNotFound,
							CROSS_ORIGIN: t.refreshTokenCrossOrigin,
							INVALID_GRANT: t.refreshTokenInvalidGrant,
							MISSING_REFRESH_TOKEN: t.refreshTokenMissing,
							TOKEN_NETWORK_ERROR: t.refreshTokenNetworkError,
							TOKEN_RESPONSE_INVALID: t.refreshTokenInvalidResponse
						};
						setCredentialResult({ accountId, failed: true, message: Object.hasOwn(messages, body?.code) ? messages[body.code] : t.refreshTokenFailed });
						return;
					}
					credentialGeneration.current++;
					const quotaStatusChanged = revision !== statusRevision.current;
					setStatus((current) => {
						const next = {
							quotaError: current?.quotaError,
							quotaRefreshing: current?.quotaRefreshing,
							...body.value
						};
						if (quotaStatusChanged && current !== null) {
							next.quota = current.quota;
							next.lastFetchedAt = current.lastFetchedAt;
							next.quotaError = current.quotaError;
							next.quotaRefreshing = current.quotaRefreshing;
							next.accounts = next.accounts.map((account) => {
								const previous = current.accounts?.find((candidate) => candidate.id === account.id);
								if (!previous) return account;
								const { quota, ...details } = account;
								return Object.hasOwn(previous, "quota") ? { ...details, quota: previous.quota } : details;
							});
						}
						return next;
					});
					if (!quotaStatusChanged && body.value.quotaRefreshing !== void 0) {
						quotaFollowUp.current ??= createQuotaFollowUp();
						quotaFollowUp.current.observe(body.value.quotaRefreshing === true, () => {
							loadStatus(true);
						});
					}
					setCredentialResult({ accountId, failed: false, message: t.refreshTokenSuccess });
				} catch {
					setCredentialResult({ accountId, failed: true, message: t.refreshTokenFailed });
				} finally {
					credentialRefreshInFlight.current = false;
					setBusy(null);
				}
			};
			const handleSetPrimary = async (accountId) => {
				try {
					setBusy(`primary-${accountId}`);
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "set-primary",
							accountId
						})
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleImportAgy = async () => {
				try {
					setBusy("import-agy");
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({ action: "import-agy" })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleSetAccountProxy = async (account) => {
				if (typeof window === "undefined") return;
				const next = window.prompt("为该 Google 账号绑定独立代理（如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890，留空则跟随全局代理）：", account.proxyUrl || "");
				if (next === null) return;
				try {
					setBusy(`proxy-${account.id}`);
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "set-proxy",
							accountId: account.id,
							proxyUrl: next.trim()
						})
					});
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleDeleteAccount = async (accountId) => {
				try {
					setBusy(`delete-${accountId}`);
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "delete",
							accountId
						})
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleClearCooldown = async (accountId) => {
				try {
					setBusy(`cooldown-${accountId}`);
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "clear-cooldown",
							accountId
						})
					});
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleSetStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					const updated = await api$13.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "strategy",
							strategy
						})
					});
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const toggleModel = async (modelId, checked) => {
				if (!status) return;
				const currentEnabled = status.models.filter((m) => m.enabled).map((m) => m.id);
				const nextEnabled = checked ? [.../* @__PURE__ */ new Set([...currentEnabled, modelId])] : currentEnabled.filter((id) => id !== modelId);
				try {
					const updated = await api$13.request("/models", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds: nextEnabled })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const setAllModels = async (selectAll) => {
				if (!status) return;
				const nextEnabled = selectAll ? status.models.map((m) => m.id) : [];
				try {
					const updated = await api$13.request("/models", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds: nextEnabled })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleUpdateEffort = async (effort) => {
				try {
					const updated = await api$13.request("/settings", {
						method: "POST",
						body: JSON.stringify({ defaultReasoningEffort: effort })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleSaveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] || "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(`无效的上下文容量值: ${raw}`);
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$13.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: parsed } })
					});
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear one override; the row falls back to the catalog length. */
			const handleResetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$13.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: null } })
					});
					setStatus(updated);
					setContextDrafts((prev) => {
						const model = updated.models.find((candidate) => candidate.id === modelId);
						return model === void 0 ? prev : {
							...prev,
							[modelId]: formatCapacity(model.defaultContextWindow)
						};
					});
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const handleResetAllContextWindows = async () => {
				const models = Object.keys(status?.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (typeof window !== "undefined" && !window.confirm(t.contextWindowResetAllConfirm)) return;
				try {
					setBusy("context");
					setError(null);
					const updated = await api$13.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			const quota = status?.quota;
			const groups = quota?.groups || [];
			status?.models.filter((m) => m.enabled).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPoolSection, {
						accounts: status?.accounts ?? [],
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sticky",
						busy,
						labels: t,
						loginBusyLabel: busy === "login" ? loginProgress || t.signingIn : void 0,
						onLogin: () => void handleLogin(),
						renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: { display: "flex", gap: 8, alignItems: "center" },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void handleImportAgy(),
									children: busy === "import-agy" ? "正在导入…" : "导入 agy 凭据"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-btn dsha-btn-primary",
									disabled: busy !== null,
									onClick: () => void handleLogin(),
									children: busy === "login" ? loginProgress || t.signingIn : t.addAccount
								})
							]
						}),
						onSetPrimary: (accountId) => void handleSetPrimary(accountId),
						onDelete: (accountId) => void handleDeleteAccount(accountId),
						onClearCooldown: (accountId) => void handleClearCooldown(accountId),
						onSetStrategy: (strategy) => void handleSetStrategy(strategy),
						showQuota: true,
						renderAccountActions: (account) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-btn",
									disabled: busy !== null,
									"aria-busy": busy === `credential-${account.id}`,
									"aria-label": `${t.refreshToken}: ${account.alias || account.email || account.id}`,
									onClick: () => void handleRefreshCredential(account.id),
									children: busy === `credential-${account.id}` ? t.refreshingToken : t.refreshToken
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void handleSetAccountProxy(account),
									children: busy === `proxy-${account.id}` ? "保存中…" : "独立代理"
								})
							]
						}),
						renderDetails: (account) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.accountId,
							": ",
							account.projectId || "rising-fact-p41fc",
							account.proxyUrl ? ` · 代理: ${account.proxyUrl}` : ""
						] }), credentialResult?.accountId === account.id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: credentialResult.failed ? "dsha-error" : "dsha-muted",
							role: credentialResult.failed ? "alert" : "status",
							children: credentialResult.message
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void handleRefreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map((model) => ({
									id: model.id,
									name: model.name,
									hint: model.defaultContextWindow ? formatCapacity(model.defaultContextWindow) : void 0,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: (id, enabled) => void toggleModel(id, enabled),
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									list: t.modelsSection
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-pref-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.defaultReasoningEffortHint
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsha-select",
								"aria-label": t.defaultReasoningEffort,
								value: status?.defaultReasoningEffort ?? "",
								disabled: busy !== null,
								onChange: (e) => {
									const val = e.currentTarget.value;
									handleUpdateEffort(val === "" ? null : val);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t.defaultEffortAuto
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "low",
										children: "Low"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "medium",
										children: "Medium"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "high",
										children: "High"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								onDraftChange: (id, draft) => setContextDrafts((prev) => ({
									...prev,
									[id]: draft
								})),
								onCommit: (id) => void handleSaveContextWindow(id),
								onReset: (id) => void handleResetContextWindow(id),
								onResetAll: () => void handleResetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.cacheSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.cacheDesc
							}),
							status?.cache == null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.cacheEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-meter-wrap",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-label",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.cacheHitRatio }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: status.cache.hitRatio === null ? "—" : `${(status.cache.hitRatio * 100).toFixed(1)}%` })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: `dsha-meter ${(status.cache.hitRatio ?? 0) >= .9 ? "dsha-meter-green" : "dsha-meter-cyan"}`,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.round((status.cache.hitRatio ?? 0) * 100)}%` } })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-meta",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.cacheCached,
													": ",
													status.cache.cachedTokens.toLocaleString()
												] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.cacheFresh,
													": ",
													status.cache.freshTokens.toLocaleString()
												] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.cacheRequests,
													": ",
													status.cache.requests
												] })
											]
										})
									]
								}), status.cache.lastMiss !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.cacheMiss
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: missLabel(status.cache.lastMiss.cause, t)
									})]
								}), status.cache.lastMiss.idleMs !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.cacheMissIdle
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: idleLabel(status.cache.lastMiss.idleMs)
									})]
								})] })]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: handleRefreshQuota,
									children: busy === "quota" ? t.refreshingQuota : t.refreshQuota
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaFactsScope
							}),
							status?.quotaError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-error",
								children: status.quotaError
							}),
							!status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.signedOut
							}) : groups.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.refreshingQuota : t.quotaEmpty
							}) : null,
							quota?.fetchedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-timestamp",
								children: ["更新时间: ", new Date(quota.fetchedAt).toLocaleString()]
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-error",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error }), validationUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { marginTop: "8px" },
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: validationUrl,
								target: "_blank",
								rel: "noreferrer",
								className: "dsha-btn dsha-btn-primary",
								style: {
									display: "inline-block",
									textDecoration: "none",
									padding: "4px 10px",
									fontSize: "12px"
								},
								children: t.googleValidation
							})
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/shared/command-code-contracts.ts
		/** Every level, in escalating order; the settings card renders exactly these. */
		const COMMAND_CODE_REASONING_EFFORTS = [
			"none",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		//#endregion
		//#region src/client/command-code/locales.ts
		const NS_COMMAND_CODE = "dsh-command-code";
		const zh$9 = {
			...accountPoolZh,
			title: "Command Code",
			pageDesc: "登录 Command Code，管理可用模型、上下文窗口与额度。",
			account: "账号",
			signedIn: "已登录",
			signedOut: "未登录",
			keyName: "密钥名称",
			organization: "组织",
			plan: "套餐",
			planUnknown: "—",
			subscription: "订阅状态",
			renews: "续费于",
			authenticatedAt: "登录时间",
			signIn: "浏览器登录",
			signInAgain: "重新登录",
			signingIn: "登录中...",
			signOut: "注销",
			cancelSignIn: "取消登录",
			openSignInPage: "打开登录页面",
			apiKeySection: "手动填写 API Key",
			apiKeyHint: "在 Command Code Studio 创建 API Key 后粘贴到此处；浏览器登录不可用时使用。",
			apiKeyPlaceholder: "粘贴 Command Code API Key",
			apiKeySave: "保存并验证",
			apiKeySaving: "验证中...",
			apiKeySaved: "已保存",
			connection: "连接",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			routeOwned: "模型路由由本插件提供",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重试。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中；全部取消勾选或关闭概览卡片上的开关可在列表中隐藏该供应商。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			catalogStale: "目录来自缓存，可能过期；可手动刷新",
			catalogFresh: "目录已同步",
			zdrEnabled: "已请求零数据保留（ZDR）；服务端无符合条件的路由时将拒绝请求，不自动降低隐私要求。",
			selectAll: "全选",
			unselectAll: "全不选",
			wireAnthropic: "Anthropic",
			wireOpenai: "OpenAI",
			wireResponses: "OpenAI Responses",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考深度",
			defaultReasoningEffortHint: "控制支持推理的模型在未单独指定时的思考强度。Anthropic 模型会映射为 thinking 预算。",
			defaultEffortAuto: "使用 Provider 默认值",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认取 Command Code 模型目录的 context length；可覆盖为自定义容量，该值用于 DSH 的压缩与溢出判断，可输入 1M、512K、200K 等容量。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			save: "保存",
			saved: "已保存",
			saving: "保存中...",
			quotaSection: "用量与配额",
			quotaDesc: "数据来自 Command Code 账户接口，页面可见时最多每 60 秒刷新一次。",
			refreshQuota: "刷新用量",
			refreshingQuota: "刷新中...",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaCredits: "剩余额度",
			quotaUnlimited: "不限量",
			updatedAt: "更新时间：{time}",
			loading: "加载中...",
			loginFailed: "登录失败",
			tokens: "tokens"
		};
		const en$9 = {
			...accountPoolEn,
			title: "Command Code",
			pageDesc: "Sign in to Command Code and manage models, context windows, and quota.",
			account: "Account",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			keyName: "Key name",
			organization: "Organization",
			plan: "Plan",
			planUnknown: "—",
			subscription: "Subscription",
			renews: "renews",
			authenticatedAt: "Signed in at",
			signIn: "Sign in with browser",
			signInAgain: "Sign in again",
			signingIn: "Signing in...",
			signOut: "Sign out",
			cancelSignIn: "Cancel",
			openSignInPage: "Open the sign-in page",
			apiKeySection: "Paste an API key",
			apiKeyHint: "Create a key in Command Code Studio and paste it here; use this when the browser flow is unavailable.",
			apiKeyPlaceholder: "Command Code API key",
			apiKeySave: "Save and verify",
			apiKeySaving: "Verifying...",
			apiKeySaved: "Saved",
			connection: "Connection",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			routeOwned: "This plugin serves the model route",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			modelsSection: "Models",
			modelsHint: "Checked models appear in the DSH conversation model list; unchecking all or turning off the switch on the overview card hides this provider.",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			catalogStale: "Cached catalog may be stale; refresh to revalidate",
			catalogFresh: "Catalog synchronized",
			zdrEnabled: "Zero Data Retention requested; requests fail closed if no compliant route is available.",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			wireAnthropic: "Anthropic",
			wireOpenai: "OpenAI",
			wireResponses: "OpenAI Responses",
			enhanced: "Enhanced features",
			defaultReasoningEffort: "Default reasoning effort",
			defaultReasoningEffortHint: "Reasoning effort for models that support it when the conversation does not specify one. Anthropic models map it to a thinking budget.",
			defaultEffortAuto: "Use provider default",
			contextWindowSection: "Model context window",
			contextWindowHint: "Defaults to the context length in the Command Code catalog; override it with the capacity DSH should use for compaction and overflow decisions (e.g., 1M, 512K, 200K).",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			save: "Save",
			saved: "Saved",
			saving: "Saving...",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the Command Code account endpoints; refreshes at most once every 60 seconds while visible.",
			refreshQuota: "Refresh quota",
			refreshingQuota: "Refreshing...",
			quotaEmpty: "No quota data yet — use “Refresh quota” to retry.",
			quotaCredits: "Remaining credits",
			quotaUnlimited: "Unlimited",
			updatedAt: "Updated at: {time}",
			loading: "Loading...",
			loginFailed: "Sign-in failed",
			tokens: "tokens"
		};
		const dictionaries$9 = {
			zh: zh$9,
			"zh-CN": zh$9,
			en: en$9,
			"en-US": en$9
		};
		//#endregion
		//#region src/client/command-code/CommandCodeSection.tsx
		/**
		* Display label per reasoning level. The locale dictionary only accepts flat
		* string values, so this nested table lives with the control that renders it.
		*/
		const EFFORT_LABELS$3 = {
			none: "Off",
			minimal: "Minimal",
			low: "Low",
			medium: "Medium",
			high: "High",
			xhigh: "X-High",
			max: "Max"
		};
		const api$12 = createLineApi("/wb/command-code/api", "Command Code");
		/**
		* Route name shown next to a model.
		*
		* The three routes are not interchangeable: the provider serves each model on
		* exactly one and rejects the others, so the label states which one this model
		* actually uses.
		*/
		function wireLabel(wire, t) {
			if (wire === "anthropic") return t.wireAnthropic;
			if (wire === "responses") return t.wireResponses;
			return t.wireOpenai;
		}
		function CommandCodeSection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loginProgress, setLoginProgress] = (0, react.useState)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [apiKey, setApiKey] = (0, react.useState)("");
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const t = zh$9;
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const data = await api$12.request("/status");
					setStatus(data);
					setContextDrafts(contextDraftsFor(data));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(data.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (err) {
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			const handleLogin = async () => {
				try {
					setBusy("login");
					setError(null);
					setLoginProgress(null);
					const flow = await api$12.request("/login", { method: "POST" });
					if (flow.authUrl) window.open(flow.authUrl, "_blank");
					const pollTimer = window.setInterval(() => {
						(async () => {
							try {
								const poll = await api$12.request("/login/status");
								if (poll.progress) setLoginProgress(poll.progress);
								if (poll.status === "complete") {
									window.clearInterval(pollTimer);
									setBusy(null);
									setLoginProgress(null);
									await loadStatus();
									notifyChange();
								} else if (poll.status === "error") {
									window.clearInterval(pollTimer);
									setBusy(null);
									setLoginProgress(null);
									setError(poll.error || t.loginFailed);
								}
							} catch {}
						})();
					}, 1500);
					window.setTimeout(() => {
						window.clearInterval(pollTimer);
						setBusy(null);
						setLoginProgress(null);
					}, 300 * 1e3);
				} catch (err) {
					setBusy(null);
					setLoginProgress(null);
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleApiKey = async () => {
				try {
					setBusy("apikey");
					setError(null);
					const updated = await api$12.request("/login/apikey", {
						method: "POST",
						body: JSON.stringify({ apiKey })
					});
					setStatus(updated);
					setApiKey("");
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/** One account-level action on the shared pool card. */
			const handleAccountAction = async (action, accountId) => {
				try {
					setBusy(`${action}-${accountId}`);
					setError(null);
					const updated = await api$12.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action,
							accountId
						})
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleSetStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					const updated = await api$12.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "strategy",
							strategy
						})
					});
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/**
			* Re-authorize one key.
			*
			* Nothing is deleted: the failure marker is cleared and the ordinary sign-in
			* flow runs again, so the account keeps its alias and place in the rotation.
			*/
			const handleRelogin = (accountId) => {
				(async () => {
					try {
						const updated = await api$12.request("/accounts", {
							method: "POST",
							body: JSON.stringify({
								action: "relogin",
								accountId
							})
						});
						setStatus(updated);
					} catch (err) {
						setError(err instanceof Error ? err.message : String(err));
						return;
					}
					await handleLogin();
				})();
			};
			const handleRefreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					const updated = await api$12.request("/quota", { method: "POST" });
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleRefreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					const updated = await api$12.request("/catalog/refresh", { method: "POST" });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleTestConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					await api$12.post("/connection/test");
					await loadStatus(true);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const applyEnabled = async (enabledModelIds) => {
				try {
					const updated = await api$12.request("/models", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const toggleModel = (modelId, checked) => {
				if (!status) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = checked ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabled(next);
			};
			const setAllModels = (selectAll) => {
				if (!status || status.models.length === 0) return;
				applyEnabled(selectAll ? status.models.map((model) => model.id) : []);
			};
			const handleUpdateEffort = async (effort) => {
				try {
					const updated = await api$12.request("/settings", {
						method: "POST",
						body: JSON.stringify({ defaultReasoningEffort: effort })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleSaveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] || "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(`Invalid context capacity: ${raw}`);
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$12.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: parsed } })
					});
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear one override; the row falls back to the catalog length. */
			const handleResetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$12.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: null } })
					});
					setStatus(updated);
					setContextDrafts((prev) => {
						const model = updated.models.find((candidate) => candidate.id === modelId);
						return model === void 0 ? prev : {
							...prev,
							[modelId]: formatCapacity(model.defaultContextWindow)
						};
					});
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const handleResetAllContextWindows = async () => {
				const models = Object.keys(status?.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (typeof window !== "undefined" && !window.confirm(t.contextWindowResetAllConfirm)) return;
				try {
					setBusy("context");
					setError(null);
					const updated = await api$12.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			const quota = status?.quota;
			status?.account;
			status?.models.filter((model) => model.enabled).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts: status?.accounts ?? [],
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						busy,
						labels: t,
						loginBusyLabel: busy === "login" ? loginProgress || t.signingIn : void 0,
						onLogin: () => void handleLogin(),
						onSetPrimary: (accountId) => void handleAccountAction("set-primary", accountId),
						onDelete: (accountId) => void handleAccountAction("delete", accountId),
						onClearCooldown: (accountId) => void handleAccountAction("clear-cooldown", accountId),
						onRelogin: (accountId) => handleRelogin(accountId),
						onSetStrategy: (strategy) => void handleSetStrategy(strategy),
						showQuota: true,
						renderDetails: (entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entry.keyName && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.keyName,
							": ",
							entry.keyName
						] }), entry.planLabel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.plan,
							": ",
							entry.planLabel
						] })] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { paddingTop: 12 },
							children: t.apiKeyHint
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-capacity-control",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "password",
								"aria-label": t.apiKeySection,
								placeholder: t.apiKeyPlaceholder,
								value: apiKey,
								onChange: (event) => setApiKey(event.currentTarget.value),
								onKeyDown: (event) => {
									if (event.key === "Enter" && apiKey.trim() !== "") handleApiKey();
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsha-context-save",
								disabled: busy !== null || apiKey.trim() === "",
								onClick: () => void handleApiKey(),
								children: busy === "apikey" ? t.apiKeySaving : t.apiKeySave
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void handleTestConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void handleRefreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							status?.catalogStale !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsha-muted",
								"data-testid": "command-code-catalog-freshness",
								children: [
									status.catalogStale ? t.catalogStale : t.catalogFresh,
									" · ",
									formatDate(status.catalogFetchedAt)
								]
							}),
							status?.zeroDataRetention === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								"data-testid": "command-code-zdr",
								children: t.zdrEnabled
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map((model) => ({
									id: model.id,
									name: model.name,
									hint: wireLabel(model.wire, t),
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									list: t.modelsSection
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-pref-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.defaultReasoningEffortHint
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsha-select",
								"aria-label": t.defaultReasoningEffort,
								value: status?.defaultReasoningEffort ?? "",
								disabled: busy !== null,
								onChange: (event) => {
									const value = event.currentTarget.value;
									handleUpdateEffort(value === "" ? null : value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t.defaultEffortAuto
								}), COMMAND_CODE_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: effort,
									children: EFFORT_LABELS$3[effort]
								}, effort))]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									inputLabel: `${model.name} context window`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								onDraftChange: (id, draft) => setContextDrafts((prev) => ({
									...prev,
									[id]: draft
								})),
								onCommit: (id) => void handleSaveContextWindow(id),
								onReset: (id) => void handleResetContextWindow(id),
								onResetAll: () => void handleResetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void handleRefreshQuota(),
									children: busy === "quota" ? t.refreshingQuota : t.refreshQuota
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaFactsScope
							}),
							!status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.signedOut
							}) : quota === null || quota === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.refreshingQuota : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.quotaCredits }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota.unlimited ? t.quotaUnlimited : quota.creditBalance !== null ? quota.creditBalance : "—" })]
									}),
									quota.meters.filter((meter) => meter.remainingFraction === null).map((meter) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-label",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: meter.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: meter.limit ?? "—" })]
											}),
											meter.used !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsha-meter-meta",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													meter.used,
													" / ",
													meter.limit ?? "—"
												] })
											}),
											meter.description !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsha-meter-meta",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: meter.description })
											})
										]
									}, meter.id)),
									quota.meters.length === 0 && quota.windows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-timestamp",
										children: t.updatedAt.replace("{time}", new Date(quota.fetchedAt).toLocaleString())
									})
								]
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/shared/kimi-code-contracts.ts
		/** Every level, in escalating order; the settings card renders exactly these. */
		const KIMI_CODE_REASONING_EFFORTS = [
			"low",
			"high",
			"max",
			"none"
		];
		//#endregion
		//#region src/client/kimi-code/locales.ts
		const NS_KIMI_CODE = "dsh-kimi-code";
		const zh$8 = {
			...accountPoolZh,
			title: "Kimi Code",
			pageDesc: "登录 Kimi Code 订阅，管理模型、思考档位、上下文窗口与额度。",
			account: "账号",
			signedIn: "已登录",
			signedOut: "未登录",
			nickname: "昵称",
			email: "邮箱",
			plan: "套餐",
			planUnknown: "—",
			region: "区域",
			regionMainland: "中国大陆 (kimi.com)",
			regionGlobal: "国际 (kimi.ai)",
			authenticatedAt: "登录时间",
			refreshRejected: "刷新令牌已被拒绝，请重新登录。",
			signIn: "设备码登录",
			signInAgain: "重新登录",
			signingIn: "登录中...",
			signOut: "注销",
			cancelSignIn: "取消登录",
			deviceCodeSection: "设备码授权",
			deviceCodeHint: "在浏览器中打开下方链接（已自动填充用户码），确认后用同一账号授权。",
			openSignInPage: "打开授权页面",
			copyCode: "复制用户码",
			copied: "已复制",
			userCode: "用户码",
			codeExpires: "有效期至",
			waitingAuthorization: "等待浏览器授权...",
			requestingCode: "正在申请设备码...",
			connection: "连接",
			oauthHost: "OAuth 主机",
			codingEndpoint: "模型接口",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			testSuccess: "连接正常",
			testFailed: "连接失败：Kimi Code 未接受当前凭据",
			routeOwned: "模型路由由本插件提供",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重试。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中；全部取消勾选或关闭概览卡片上的开关可在列表中隐藏该供应商。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			selectAll: "全选",
			unselectAll: "全不选",
			wireAnthropic: "Anthropic",
			wireOpenai: "OpenAI",
			capVideo: "视频*",
			capDynamicTools: "动态工具",
			capImageOnly: "仅图片",
			capNone: "—",
			capVideoFootnote: "* 视频输入需先由 kimi_attach_video 工具挂载（本地绝对路径或 http(s) 链接）；直接粘贴的上传路径仍只支持图片。",
			capabilitiesTitle: "模型能力",
			capColMedia: "多模态",
			capColTools: "动态工具",
			capColNotes: "说明",
			capPlan: "需要套餐：{plan}",
			capInputCap: "输入上限 {tokens}",
			capNoTools: "不支持工具",
			speedRegular: "标准",
			speedHighspeed: "高速 (约 6×)",
			quotaCost: "额度倍率",
			minimumPlan: "所需套餐",
			enhanced: "思考设置",
			defaultReasoningEffort: "默认思考档位",
			defaultReasoningEffortHint: "Kimi Code 只接受 low / high / max 三档；none 表示关闭思考。切换档位会使上下文缓存失效，建议在同一会话中保持一致。",
			cacheTtl: "上下文缓存时长",
			cacheTtlHint: "Kimi 按前缀自动缓存，这里选择写入时长。1h 写入约为 5m 的两倍价，只有当同一前缀会在一小时内被反复读取才划算；档位在首次写入时锁定，之后无法改写。留空表示不指定，由 Kimi 自己决定（实测有效期约 5–30 分钟）。依据回合间隔选：间隔通常短于约 30 分钟就留空或选 5 分钟；调度、等子代理这类会出现长空闲的会话选 1 小时。",
			cacheTtlDefault: "不指定（Kimi 默认）",
			cacheTtl5m: "5 分钟",
			cacheTtl1h: "1 小时",
			defaultEffortAuto: "使用模型默认值",
			effortLow: "低 (low)",
			effortHigh: "高 (high)",
			effortMax: "最高 (max)",
			effortNone: "关闭思考",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认取模型目录的上下文长度。k3 的 1M 上下文需要 Allegretto 及以上套餐，因此默认按 256K 计算；如已升级可在此覆盖为 1M。",
			contextWindowPlan: "完整上下文需要 {plan} 套餐",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			save: "保存",
			saved: "已保存",
			saving: "保存中...",
			cacheSection: "缓存与 K3 调优",
			cacheDesc: "Kimi 的前缀缓存按请求内容自动命中，无需也无法手动声明，因此这里用读缓存比例反映实际效果。",
			cacheEmpty: "本进程还没有带用量回报的请求。",
			cacheHitRatio: "缓存命中率",
			cacheCached: "命中 tokens",
			cacheFresh: "新处理 tokens",
			cacheOutput: "输出 tokens",
			cacheRequests: "请求数",
			cacheHint: "同一会话内：系统提示与工具列表一旦变化会使缓存整体失效，因此保持工具集合稳定、把新增内容追加在末尾，命中率最高。",
			cacheExpired: "本会话已空闲超过缓存有效期，下一轮将重新处理约 {tokens} 个 token。",
			cacheDrift: "最近前缀状态",
			cacheDriftFirst: "首个请求（缓存为空）",
			cacheDriftStable: "稳定（前缀未变）",
			cacheDriftSystemPrompt: "系统提示已变化（缓存失效）",
			cacheDriftTools: "工具列表已变化（缓存失效）",
			cacheDriftCacheKey: "缓存键已变化（会话切换）",
			cacheDriftColdKey: "未发送缓存键（无法命中）",
			preserveThinking: "保留思考 (Preserved Thinking)",
			preserveOn: "已开启（官方默认）：跨轮保留 reasoning_content，多轮工具调用更连贯，但思考 token 也计入输出。",
			preserveOff: "已关闭：不要求服务回传推理内容。可设置 DSH_KIMI_CODE_PRESERVE_THINKING=0 关闭。",
			outputCap: "输出上限跟随上下文窗口，长思考不会被 32K 截断",
			quotaSection: "用量与额度",
			quotaDesc: "数据来自 Kimi Code 账户接口，页面可见时最多每 60 秒刷新一次。",
			refreshQuota: "刷新用量",
			refreshingQuota: "刷新中...",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaPlan: "当前套餐",
			quotaWallet: "加油包余额",
			quotaWalletLimit: "月度上限",
			quotaWalletUsed: "本月已用",
			updatedAt: "更新时间：{time}",
			resetAt: "重置：{time}",
			loading: "加载中...",
			loginFailed: "登录失败",
			requests: "次请求",
			tokens: "tokens"
		};
		const en$8 = {
			...accountPoolEn,
			title: "Kimi Code",
			pageDesc: "Sign in to the Kimi Code subscription and manage models, thinking level, context windows, and quota.",
			account: "Account",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			nickname: "Nickname",
			email: "Email",
			plan: "Plan",
			planUnknown: "—",
			region: "Region",
			regionMainland: "Mainland China (kimi.com)",
			regionGlobal: "Global (kimi.ai)",
			authenticatedAt: "Signed in at",
			refreshRejected: "The refresh token was rejected — sign in again.",
			signIn: "Sign in with device code",
			signInAgain: "Sign in again",
			signingIn: "Signing in...",
			signOut: "Sign out",
			cancelSignIn: "Cancel",
			deviceCodeSection: "Device authorization",
			deviceCodeHint: "Open the link below in a browser (the user code is pre-filled) and approve it with the same account.",
			openSignInPage: "Open the sign-in page",
			copyCode: "Copy user code",
			copied: "Copied",
			userCode: "User code",
			codeExpires: "Expires at",
			waitingAuthorization: "Waiting for browser authorization...",
			requestingCode: "Requesting a device code...",
			connection: "Connection",
			oauthHost: "OAuth host",
			codingEndpoint: "Model endpoint",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			testSuccess: "Connection OK",
			testFailed: "Connection failed: Kimi Code did not accept the stored credential",
			routeOwned: "This plugin serves the model route",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			modelsSection: "Models",
			modelsHint: "Checked models appear in the DSH conversation model list; unchecking all or turning off the switch on the overview card hides this provider.",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			wireAnthropic: "Anthropic",
			wireOpenai: "OpenAI",
			capVideo: "Video*",
			capDynamicTools: "Dynamic tools",
			capImageOnly: "Images",
			capNone: "—",
			capVideoFootnote: "* Video input is attached with the kimi_attach_video tool (an absolute local path or an http(s) URL); the paste/upload path still accepts images only.",
			capabilitiesTitle: "Capabilities",
			capColMedia: "Multimodal",
			capColTools: "Dynamic tools",
			capColNotes: "Notes",
			capPlan: "Requires plan: {plan}",
			capInputCap: "Input cap {tokens}",
			capNoTools: "No tools",
			speedRegular: "Regular",
			speedHighspeed: "HighSpeed (~6x)",
			quotaCost: "Quota cost",
			minimumPlan: "Required plan",
			enhanced: "Thinking",
			defaultReasoningEffort: "Default thinking level",
			defaultReasoningEffortHint: "Kimi Code accepts only low / high / max; none disables thinking. Switching the level invalidates the context cache, so keep it steady within a session.",
			cacheTtl: "Context cache duration",
			cacheTtlHint: "Kimi caches prefixes automatically; this chooses the write duration. A 1h write costs about twice a 5m one and only pays off when the same prefix is re-read within the hour. The tier is locked when first written and cannot be changed afterwards. Leave unset to send no cache field and let Kimi decide (measured lifetime is roughly 5-30 minutes). Choose by the gap between turns: leave unset or use 5 minutes when turns are normally less than about 30 minutes apart, and pick 1 hour for a session that idles for long stretches, such as dispatch work waiting on subagents.",
			cacheTtlDefault: "Unset (Kimi default)",
			cacheTtl5m: "5 minutes",
			cacheTtl1h: "1 hour",
			defaultEffortAuto: "Use the model default",
			effortLow: "Low",
			effortHigh: "High",
			effortMax: "Max",
			effortNone: "Thinking off",
			contextWindowSection: "Model context window",
			contextWindowHint: "Defaults to the catalog context length. k3 reaches 1M only on Allegretto and above, so it defaults to 256K; raise the override here after upgrading.",
			contextWindowPlan: "Full context requires the {plan} plan",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			save: "Save",
			saved: "Saved",
			saving: "Saving...",
			cacheSection: "Cache & K3 tuning",
			cacheDesc: "Kimi's prefix cache is automatic and content-hash based — there is no marker to set — so the cache-read ratio is the only evidence it is working.",
			cacheEmpty: "No request in this process has reported usage yet.",
			cacheExpired: "This conversation sat idle past the cache lifetime, so the next turn reprocesses about {tokens} tokens.",
			cacheHitRatio: "Cache hit ratio",
			cacheCached: "Cached tokens",
			cacheFresh: "Fresh tokens",
			cacheOutput: "Output tokens",
			cacheRequests: "Requests",
			cacheHint: "Within one session: any change to the system prompt or the tool list invalidates the whole prefix cache, so keep the tool set stable and append new material at the tail for the best hit rate.",
			cacheDrift: "Last prefix state",
			cacheDriftFirst: "First request (cache cold)",
			cacheDriftStable: "Stable (prefix unchanged)",
			cacheDriftSystemPrompt: "System prompt changed (cache invalidated)",
			cacheDriftTools: "Tool list changed (cache invalidated)",
			cacheDriftCacheKey: "Cache key changed (session switch)",
			cacheDriftColdKey: "No cache key sent (cannot hit)",
			preserveThinking: "Preserved Thinking",
			preserveOn: "On (the official default): reasoning_content is retained across turns, which keeps multi-step tool use coherent — its tokens are billed as output.",
			preserveOff: "Off: the service is not asked to return reasoning. Set DSH_KIMI_CODE_PRESERVE_THINKING=0 to disable.",
			outputCap: "Output cap follows the context window, so long reasoning is not cut off at 32K",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the Kimi Code account endpoints; refreshes at most once every 60 seconds while visible.",
			refreshQuota: "Refresh quota",
			refreshingQuota: "Refreshing...",
			quotaEmpty: "No quota data yet — use \"Refresh quota\" to retry.",
			quotaPlan: "Current plan",
			quotaWallet: "Booster wallet",
			quotaWalletLimit: "Monthly cap",
			quotaWalletUsed: "Used this month",
			updatedAt: "Updated at: {time}",
			resetAt: "Reset: {time}",
			loading: "Loading...",
			loginFailed: "Sign-in failed",
			requests: "requests",
			tokens: "tokens"
		};
		const dictionaries$8 = {
			zh: zh$8,
			"zh-CN": zh$8,
			en: en$8,
			"en-US": en$8
		};
		//#endregion
		//#region src/client/kimi-code/KimiModelCapabilities.tsx
		/**
		* Capability table for the Kimi model list.
		*
		* Extracted from the settings card so the layout is testable: an earlier
		* revision inlined each capability as prose beside the model name, which
		* stretched the name column and pushed the descriptions out of alignment.
		* Capabilities are now short tags in their own columns, with the per-model
		* detail kept in a hover title.
		*/
		const t = zh$8;
		/**
		* Render one quota multiplier the way the official table states it: "2x", "3x".
		*
		* The value is transcribed, never computed — the service is the only party that
		* knows how a request is billed, so this shows what the model table declares.
		*/
		function formatMultiplier(value) {
			return `${value}x`;
		}
		function KimiModelCapabilities({ models }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-cap-table",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t.capabilitiesTitle }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t.capColMedia }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t.capColTools }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t.capColNotes })
				] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: models.map((model) => {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
							title: [
								model.id,
								model.wire === "anthropic" ? t.wireAnthropic : t.wireOpenai,
								...model.defaultReasoningEffort ? [t.defaultReasoningEffort + ": " + model.defaultReasoningEffort] : [],
								...model.maxInputTokens === void 0 ? [] : [t.capInputCap.replace("{tokens}", String(model.maxInputTokens))],
								...model.minimumPlan ? [t.capPlan.replace("{plan}", model.minimumPlan)] : [],
								...model.quotaMultiplier === null ? [] : [`${t.quotaCost}: ${formatMultiplier(model.quotaMultiplier)}`]
							].join(" · "),
							children: model.name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: model.supportsVideo ? "dsha-cap-on" : "dsha-cap-off",
							children: model.supportsVideo ? t.capVideo : t.capImageOnly
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: model.supportsDynamicTools ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsha-cap-on",
							children: t.capDynamicTools
						}) : model.supportsToolUse ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsha-cap-off",
							children: t.capNone
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsha-cap-off",
							children: t.capNoTools
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
							className: "dsha-cap-notes",
							children: [model.quotaMultiplier === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsha-cap-cost",
								children: [
									t.quotaCost,
									" ",
									formatMultiplier(model.quotaMultiplier)
								]
							}), model.description ?? ""]
						})
					] }, model.id);
				}) })] }), models.some((model) => model.supportsVideo) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsha-muted dsha-cap-footnote",
					children: t.capVideoFootnote
				})]
			});
		}
		//#endregion
		//#region src/client/kimi-code/KimiCodeSection.tsx
		const api$11 = createLineApi("/wb/kimi-code/api", "Kimi Code");
		/** Money the service reports in minor units, rendered in its own currency. */
		function formatMoney(cents, currency) {
			if (cents === null) return "—";
			const code = currency ?? "USD";
			try {
				return new Intl.NumberFormat(void 0, {
					style: "currency",
					currency: code
				}).format(cents / 100);
			} catch {
				return `${(cents / 100).toFixed(2)} ${code}`;
			}
		}
		const EFFORT_LABEL = {
			low: zh$8.effortLow,
			high: zh$8.effortHigh,
			max: zh$8.effortMax,
			none: zh$8.effortNone
		};
		/** Human label for the last request's prefix-drift cause. */
		function driftLabel(cause, t) {
			switch (cause) {
				case "first-request": return t.cacheDriftFirst;
				case "stable": return t.cacheDriftStable;
				case "system-prompt": return t.cacheDriftSystemPrompt;
				case "tools": return t.cacheDriftTools;
				case "cache-key": return t.cacheDriftCacheKey;
				case "cold-key": return t.cacheDriftColdKey;
				default: return String(cause);
			}
		}
		function KimiCodeSection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [flow, setFlow] = (0, react.useState)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(false);
			const [connectionNotice, setConnectionNotice] = (0, react.useState)(null);
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const t = zh$8;
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const data = await api$11.request("/status");
					setStatus(data);
					setContextDrafts(contextDraftsFor(data));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(data.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (err) {
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			(0, react.useEffect)(() => {
				if (flow?.status !== "pending") return;
				const timer = window.setInterval(() => {
					(async () => {
						try {
							const poll = await api$11.request("/login/status");
							setFlow(poll);
							if (poll.status === "complete") {
								await loadStatus();
								notifyChange();
							} else if (poll.status === "error") setError(poll.error || t.loginFailed);
						} catch {}
					})();
				}, 2e3);
				return () => window.clearInterval(timer);
			}, [
				flow?.status,
				loadStatus,
				notifyChange,
				t.loginFailed
			]);
			const handleLogin = async () => {
				try {
					setBusy("login");
					setError(null);
					setCopied(false);
					const next = await api$11.request("/login", {
						method: "POST",
						body: JSON.stringify({})
					});
					setFlow(next);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleCancelLogin = async () => {
				try {
					await api$11.request("/login/cancel", { method: "POST" });
					setFlow({ status: "idle" });
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleCopyCode = async () => {
				const code = flow?.userCode;
				if (!code) return;
				try {
					await navigator.clipboard.writeText(code);
					setCopied(true);
					window.setTimeout(() => setCopied(false), 2e3);
				} catch {}
			};
			/** One account-level action on the shared pool card. */
			const handleAccountAction = async (action, accountId) => {
				try {
					setBusy(`${action}-${accountId}`);
					setError(null);
					const updated = await api$11.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action,
							accountId
						})
					});
					setStatus(updated);
					setFlow({ status: "idle" });
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleSetStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					const updated = await api$11.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "strategy",
							strategy
						})
					});
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/**
			* Re-authorize one account.
			*
			* Nothing is deleted: the failure marker is cleared and the device-code flow
			* runs again, so the account keeps its alias and place in the rotation.
			*/
			const handleRelogin = (accountId) => {
				(async () => {
					try {
						const updated = await api$11.request("/accounts", {
							method: "POST",
							body: JSON.stringify({
								action: "relogin",
								accountId
							})
						});
						setStatus(updated);
					} catch (err) {
						setError(err instanceof Error ? err.message : String(err));
						return;
					}
					await handleLogin();
				})();
			};
			const handleRefreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					const updated = await api$11.request("/quota", { method: "POST" });
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					await loadStatus(true);
				} finally {
					setBusy(null);
				}
			};
			const handleRefreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					const updated = await api$11.request("/catalog/refresh", { method: "POST" });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const handleTestConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					setConnectionNotice(null);
					const result = await api$11.request("/connection/test", { method: "POST" });
					setConnectionNotice(result.connected ? `${t.testSuccess} · ${result.latencyMs} ms` : t.testFailed);
					await loadStatus(true);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const applyEnabled = async (enabledModelIds) => {
				try {
					const updated = await api$11.request("/models", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const toggleModel = (modelId, checked) => {
				if (!status) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = checked ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabled(next);
			};
			const setAllModels = (selectAll) => {
				if (!status || status.models.length === 0) return;
				applyEnabled(selectAll ? status.models.map((model) => model.id) : []);
			};
			const handleUpdateEffort = async (effort) => {
				try {
					const updated = await api$11.request("/settings", {
						method: "POST",
						body: JSON.stringify({ defaultReasoningEffort: effort })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleUpdateCacheTtl = async (ttl) => {
				try {
					const updated = await api$11.request("/settings", {
						method: "POST",
						body: JSON.stringify({ cacheTtl: ttl })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const handleSaveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] || "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(`Invalid context capacity: ${raw}`);
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$11.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: parsed } })
					});
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear one override; the row falls back to the catalog length. */
			const handleResetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$11.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: null } })
					});
					setStatus(updated);
					setContextDrafts((prev) => {
						const model = updated.models.find((candidate) => candidate.id === modelId);
						return model === void 0 ? prev : {
							...prev,
							[modelId]: formatCapacity(model.defaultContextWindow)
						};
					});
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const handleResetAllContextWindows = async () => {
				const models = Object.keys(status?.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (typeof window !== "undefined" && !window.confirm(t.contextWindowResetAllConfirm)) return;
				try {
					setBusy("context");
					setError(null);
					const updated = await api$11.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			const quota = status?.quota;
			status?.account;
			status?.models.filter((model) => model.enabled).length;
			const loginPending = flow?.status === "pending";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPoolSection, {
						accounts: status?.accounts ?? [],
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						busy,
						labels: t,
						loginBusyLabel: loginPending ? t.waitingAuthorization : busy === "login" ? t.requestingCode : void 0,
						onLogin: () => void handleLogin(),
						onSetPrimary: (accountId) => void handleAccountAction("set-primary", accountId),
						onDelete: (accountId) => void handleAccountAction("delete", accountId),
						onClearCooldown: (accountId) => void handleAccountAction("clear-cooldown", accountId),
						onRelogin: (accountId) => handleRelogin(accountId),
						onSetStrategy: (strategy) => void handleSetStrategy(strategy),
						showQuota: true,
						renderDetails: (entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entry.planName && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.plan,
							": ",
							entry.planName
						] }), entry.region && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.region,
							": ",
							entry.region === "global" ? t.regionGlobal : t.regionMainland
						] })] }),
						children: loginPending && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-device-box",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.deviceCodeSection }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.deviceCodeHint
								}),
								flow?.userCode && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-code-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-code",
										children: flow.userCode
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										onClick: () => void handleCopyCode(),
										children: copied ? t.copied : t.copyCode
									})]
								}),
								flow?.verificationUriComplete && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: "dsha-link",
									href: flow.verificationUriComplete,
									target: "_blank",
									rel: "noreferrer noopener",
									children: flow.verificationUriComplete
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.codeExpires
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: formatDate(flow?.expiresAt)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-actions",
									children: [flow?.verificationUriComplete && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										className: "dsha-btn",
										href: flow.verificationUriComplete,
										target: "_blank",
										rel: "noreferrer noopener",
										children: t.openSignInPage
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null,
										onClick: () => void handleCancelLogin(),
										children: t.cancelSignIn
									})]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.oauthHost
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: status?.oauthHost || "—"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.codingEndpoint
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: status?.codingBaseUrl || "—"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							connectionNotice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: connectionNotice
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void handleTestConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.cacheSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.cacheDesc
							}),
							status?.cacheHint != null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-warn",
								children: t.cacheExpired.replace("{tokens}", status.cacheHint.totalTokens.toLocaleString())
							}),
							status?.cache == null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.cacheEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-label",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.cacheHitRatio }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: status.cache.hitRatio === null ? "—" : `${(status.cache.hitRatio * 100).toFixed(1)}%` })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: `dsha-meter ${(status.cache.hitRatio ?? 0) >= .9 ? "dsha-meter-green" : "dsha-meter-cyan"}`,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.round((status.cache.hitRatio ?? 0) * 100)}%` } })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-meta",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheCached,
														": ",
														status.cache.cachedTokens.toLocaleString()
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheFresh,
														": ",
														status.cache.freshTokens.toLocaleString()
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheOutput,
														": ",
														status.cache.outputTokens.toLocaleString()
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheRequests,
														": ",
														status.cache.requests
													] })
												]
											})
										]
									}),
									status.cache.lastDrift !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.cacheDrift
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: driftLabel(status.cache.lastDrift, t)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.cacheHint
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void handleRefreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map((model) => ({
									id: model.id,
									name: model.name,
									hint: [
										model.wire === "anthropic" ? t.wireAnthropic : t.wireOpenai,
										...model.supportsVideo ? [t.capVideo] : [],
										...model.supportsDynamicTools ? [t.capDynamicTools] : [],
										...model.minimumPlan ? [t.capPlan.replace("{plan}", model.minimumPlan)] : []
									].join(" · "),
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									list: t.modelsSection
								}
							}),
							status !== null && status.models.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KimiModelCapabilities, { models: status.models })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.defaultReasoningEffortHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.defaultReasoningEffort,
									value: status?.defaultReasoningEffort ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										handleUpdateEffort(value === "" ? null : value);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t.defaultEffortAuto
									}), KIMI_CODE_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: effort,
										children: EFFORT_LABEL[effort]
									}, effort))]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.cacheTtl }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.cacheTtlHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.cacheTtl,
									value: status?.cacheTtl ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										handleUpdateCacheTtl(value === "" ? null : value);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t.cacheTtlDefault
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "5m",
											children: t.cacheTtl5m
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "1h",
											children: t.cacheTtl1h
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									meta: model.defaultContextWindow < model.contextWindow ? formatCapacity(model.contextWindow) : void 0,
									inputLabel: `${model.name} context window`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								metaClassName: "dsha-model-meta",
								onDraftChange: (id, draft) => setContextDrafts((prev) => ({
									...prev,
									[id]: draft
								})),
								onCommit: (id) => void handleSaveContextWindow(id),
								onReset: (id) => void handleResetContextWindow(id),
								onResetAll: () => void handleResetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void handleRefreshQuota(),
									children: busy === "quota" ? t.refreshingQuota : t.refreshQuota
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaFactsScope
							}),
							status?.quotaError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status.quotaError
							}),
							!status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.signedOut
							}) : quota === null || quota === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.refreshingQuota : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.quotaPlan }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota.planName || t.planUnknown })]
									}),
									quota.extraUsage !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-label",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.quotaWallet }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatMoney(quota.extraUsage.balanceCents, quota.extraUsage.currency) })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-meta",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatMoney(quota.extraUsage.totalCents, quota.extraUsage.currency) }), quota.extraUsage.monthlyChargeLimitEnabled && quota.extraUsage.monthlyChargeLimitCents !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												t.quotaWalletLimit,
												": ",
												formatMoney(quota.extraUsage.monthlyChargeLimitCents, quota.extraUsage.currency)
											] })]
										})]
									}),
									quota.windows.length === 0 && quota.extraUsage === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-timestamp",
										children: t.updatedAt.replace("{time}", new Date(quota.fetchedAt).toLocaleString())
									})
								]
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/shared/workbuddy-contracts.ts
		/**
		* Every level this route can name, in escalating order (the card's sort key).
		*
		* `none` is the one level that is not a rung of any ladder: it is the measured
		* spelling that turns the reasoning trace OFF upstream (`reasoning_effort:
		* "none"`, the value the sibling gateway sends on its own cheap calls). It is
		* only ever offered on a model the catalog marks `canDisableThinking`, so it
		* sorts below everything and is never used to converge a level onto a ladder.
		*/
		const WORKBUDDY_REASONING_EFFORTS = [
			"none",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		//#endregion
		//#region src/client/workbuddy/locales.ts
		const NS_WORKBUDDY = "dsh-workbuddy";
		const zh$7 = {
			title: "WorkBuddy",
			pageDesc: "复用本机 CodeBuddy 桌面端登录态，管理 WorkBuddy（CodeBuddy 订阅）模型、上下文窗口与额度。",
			account: "账号",
			noAccounts: "暂无账号。点击右上角「添加账号」完成浏览器授权，或登录 CodeBuddy 桌面端后重新扫描；桌面账号只能从本插件隐藏，绝不删除 CodeBuddy 的原凭据。",
			signedOut: "未找到凭据",
			nickname: "昵称",
			uin: "UIN",
			region: "区域",
			regionCn: "国区",
			regionIntl: "国际区",
			accountType: "账号类型",
			routeUnreachable: "无法读取 WorkBuddy 设置路由",
			routeUnreachableHint: "浏览器里加载的插件版本可能比 Host 进程里运行的新（客户端资源是现读磁盘的，Host 只在启动时加载）。请重启 DSH，让两端来自同一份构建。",
			rescan: "重新扫描",
			rescanning: "扫描中...",
			accounts: "账号管理",
			addCnAccount: "添加国区账号",
			addIntlAccount: "添加国际区账号",
			authorizing: "授权中…",
			loginWaiting: "请在新打开的浏览器页面完成登录与授权。",
			loginFailed: "账号授权失败",
			hiddenAccount: "已隐藏",
			hideAccount: "从插件隐藏",
			restoreAccount: "恢复显示",
			deleteAccount: "删除账号",
			deleteConfirm: "确定删除这个插件托管的账号吗？加密存储中的登录凭据会被移除。",
			connection: "连接",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			latency: "延迟",
			routeOwned: "模型路由由本插件提供",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重试。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中；未勾选或关闭上方开关可在列表中隐藏该供应商。目录与上下文窗口来自订阅网关的模型目录，并按账号所在区域过滤——跨区调用会被上游拒绝。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			selectAll: "全选",
			unselectAll: "全不选",
			imageSupport: "图片",
			textOnly: "纯文本",
			creditMultiplier: "倍率",
			creditMultiplierRegion: "{value}（{region}）",
			creditMultiplierPair: "{first} / {second}",
			regionBadge: "区域",
			unavailableHere: "当前区域不可用",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考深度",
			defaultReasoningEffortHint: "控制支持推理的模型在未单独指定时的思考强度。",
			defaultEffortAuto: "使用模型默认值",
			effortUnsupported: "当前模型不支持",
			noReasoningModels: "当前账号的模型都没有声明可用的思考档位，因此没有可选的默认档位。",
			defaultEffortKept: "已保存的档位不被当前任何模型支持，已保留但不会生效。",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认值来自订阅网关的模型目录（每个模型的真实上下文上限）；可覆盖为自定义容量，该值用于 DSH 的压缩与溢出判断，可输入 1M、512K、200K 等容量。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			save: "保存",
			saved: "已保存",
			saving: "保存中...",
			quotaSection: "用量与配额",
			quotaDesc: "数据来自订阅的计费接口，页面可见时最多每 60 秒刷新一次。",
			refreshQuota: "刷新用量",
			refreshingQuota: "刷新中...",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaPackage: "套餐",
			quotaRemaining: "剩余额度",
			quotaCycle: "本周期已用",
			quotaReset: "重置时间",
			updatedAt: "更新时间：{time}",
			loading: "加载中...",
			credits: "credits",
			composerLabel: "额度",
			dailyCheckin: "每日签到",
			checkinHint: "仅国区账号参与；DSH 启动时自动签到一次，运行期间每 10 分钟补检，进程关闭的当天不会签到。",
			checkinAuto: "自动签到",
			checkinToday: "今日已签 {done}/{total}",
			checkinSkipped: "{count} 个无签到活动",
			checkinFailed: "{count} 个失败",
			checkinLastRun: "上次运行：{time}",
			checkinNever: "尚未运行",
			checkinNow: "立即签到",
			checkinRunning: "签到中…",
			outboundSection: "出站身份",
			outboundHint: "决定请求以哪种客户端身份发出。cli 是本线路一直使用、实测可用的身份；auto 会按账号稳定分配一种（同一账号永不漂移）。换身份不会增加额度——额度按账号 × 模型的 24 小时窗口计算。",
			outboundAuto: "自动（按账号分配）",
			outboundCli: "CLI（默认，实测可用）",
			outboundWorkbuddy: "WorkBuddy 桌面端",
			outboundVscode: "VSCode 插件",
			atRestSection: "桌面凭据解密",
			atRestHint: "桌面客户端自 2026-09-24 起把 token 存成 $wbEncrypted 加密信封。粘贴一次密钥即可读取这些账号；密钥只写入系统加密存储（DPAPI / Keychain / Secret Service），不落明文、不进日志。",
			atRestPlaceholder: "64 位 hex 保护密钥，或 44 字符 base64 的 atRestSecretKey",
			atRestSave: "保存密钥",
			atRestClear: "清除密钥",
			atRestSaved: "已保存密钥",
			atRestSealed: "检测到 {count} 个加密凭据，未保存密钥前无法使用。",
			guardrailsSection: "本地额度护栏",
			guardrailsHint: "在撞上游 429 之前先停手：剩余积分低于阈值、账号当日 token 达额、或单个模型当日 token 达额时，请求会切到池里其他账号。三项都填 0 = 关闭，计数按本地 0 点重置。",
			guardrailsReserve: "保留积分",
			guardrailsDaily: "账号日 token",
			guardrailsModelDaily: "模型日 token"
		};
		const en$7 = {
			title: "WorkBuddy",
			pageDesc: "Reuse the local CodeBuddy desktop sign-in to manage WorkBuddy (CodeBuddy subscription) models, context windows, and quota.",
			account: "Account",
			noAccounts: "No accounts yet. Use “Add account” above to authorize, or sign in with the CodeBuddy desktop client and rescan; desktop accounts can only be hidden here, never removed from CodeBuddy.",
			signedOut: "No credential found",
			nickname: "Nickname",
			uin: "UIN",
			region: "Region",
			regionCn: "China",
			regionIntl: "International",
			accountType: "Account type",
			routeUnreachable: "The WorkBuddy settings route could not be read",
			routeUnreachableHint: "The plugin loaded in the browser may be newer than the one running in the Host: client assets are read from disk on demand, while the Host loads them only at startup. Restart DSH so both halves come from the same build.",
			rescan: "Rescan",
			rescanning: "Scanning...",
			accounts: "Account Management",
			addCnAccount: "Add China account",
			addIntlAccount: "Add international account",
			authorizing: "Authorizing…",
			loginWaiting: "Complete sign-in and authorization in the newly opened browser page.",
			loginFailed: "Account authorization failed",
			hiddenAccount: "Hidden",
			hideAccount: "Hide from plugin",
			restoreAccount: "Restore",
			deleteAccount: "Delete account",
			deleteConfirm: "Delete this plugin-managed account? Its encrypted credential will be removed.",
			connection: "Connection",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			latency: "Latency",
			routeOwned: "This plugin serves the model route",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			modelsSection: "Models",
			modelsHint: "Checked models appear in the DSH conversation model list. The catalog and its context windows come from the subscription gateway and are filtered by the account’s region — the upstream rejects a model asked of the wrong region.",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			imageSupport: "Images",
			textOnly: "Text only",
			creditMultiplier: "Multiplier",
			creditMultiplierRegion: "{value} ({region})",
			creditMultiplierPair: "{first} / {second}",
			regionBadge: "Regions",
			unavailableHere: "Unavailable in this region",
			enhanced: "Enhanced features",
			defaultReasoningEffort: "Default reasoning effort",
			defaultReasoningEffortHint: "Reasoning effort for models that support it when the conversation does not specify one.",
			defaultEffortAuto: "Use the model default",
			effortUnsupported: "unsupported by the current models",
			noReasoningModels: "None of this account’s models declare a reasoning level, so there is no default to choose.",
			defaultEffortKept: "The saved level is not supported by any current model; it is kept but has no effect.",
			contextWindowSection: "Model context window",
			contextWindowHint: "Defaults come from the subscription gateway’s own catalog (each model’s real context cap); override one with the capacity DSH should use for compaction and overflow decisions (e.g., 1M, 512K, 200K).",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			save: "Save",
			saved: "Saved",
			saving: "Saving...",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the subscription billing endpoint; refreshes at most once every 60 seconds while visible.",
			refreshQuota: "Refresh quota",
			refreshingQuota: "Refreshing...",
			quotaEmpty: "No quota data yet — use “Refresh quota” to retry.",
			quotaPackage: "Package",
			quotaRemaining: "Remaining credits",
			quotaCycle: "Used this cycle",
			quotaReset: "Resets",
			updatedAt: "Updated at: {time}",
			loading: "Loading...",
			credits: "credits",
			composerLabel: "Quota",
			dailyCheckin: "Daily check-in",
			checkinHint: "CN-region accounts only. The host signs in once at startup and re-checks every 10 minutes while running; a day the process never runs is not signed.",
			checkinAuto: "Auto check-in",
			checkinToday: "Checked in today {done}/{total}",
			checkinSkipped: "{count} with no activity",
			checkinFailed: "{count} failed",
			checkinLastRun: "Last run: {time}",
			checkinNever: "Never run",
			checkinNow: "Check in now",
			checkinRunning: "Checking in…",
			outboundSection: "Outbound identity",
			outboundHint: "Which client identity requests present. cli is what this route has always sent and was measured working; auto assigns one product per account and never drifts. Switching identity does not create allowance — quota is metered per account × model over a 24h window.",
			outboundAuto: "Auto (per account)",
			outboundCli: "CLI (default, measured working)",
			outboundWorkbuddy: "WorkBuddy desktop",
			outboundVscode: "VSCode extension",
			atRestSection: "Desktop credential decryption",
			atRestHint: "Since 2026-09-24 the desktop client seals its tokens as $wbEncrypted envelopes. Paste the key once to read those accounts; it is stored only in the platform credential store, never in plaintext and never logged.",
			atRestPlaceholder: "64-character hex protector key, or the 44-character base64 atRestSecretKey",
			atRestSave: "Save key",
			atRestClear: "Clear key",
			atRestSaved: "Key saved",
			atRestSealed: "{count} sealed credentials found; they stay unreadable until a key is saved.",
			guardrailsSection: "Local quota guardrails",
			guardrailsHint: "Stop before the upstream 429: below a credit floor, at the account daily token cap, or at a per-model daily token cap, the request moves to another account in the pool. 0 disables a rail; counters reset at local midnight.",
			guardrailsReserve: "Reserve credits",
			guardrailsDaily: "Account daily tokens",
			guardrailsModelDaily: "Model daily tokens"
		};
		const dictionaries$7 = {
			zh: zh$7,
			"zh-CN": zh$7,
			en: en$7,
			"en-US": en$7
		};
		//#endregion
		//#region src/client/workbuddy/useWorkBuddySection.ts
		/**
		* The WorkBuddy card's state, effects and actions.
		*
		* Split out of 'WorkBuddySection.tsx' so that file is markup and this one is
		* behaviour: what the card tracks, what it derives from a status answer, and
		* every request a control can make. The view reads one named shape — see
		* `WorkBuddySectionView` — so the contract between the two is visible here
		* rather than inferred from the JSX.
		*/
		const API$2 = "/wb/workbuddy/api";
		/**
		* The shared card's label set.
		*
		* Only the three labels WorkBuddy genuinely words differently are taken from
		* this tab's dictionary; everything else is the shared set, so the five
		* provider tabs cannot drift apart in wording.
		*/
		function accountPoolLabels(t) {
			return {
				...accountPoolZh,
				noAccounts: t.noAccounts,
				email: t.nickname
			};
		}
		/**
		* Call one settings route through the shared reader.
		*
		* This line is where the shared reader's tolerance came from: reading the body
		* as text first is what lets a route that is not mounted (an empty body, which
		* is exactly what a stale host half produces) be reported as such instead of as
		* a bare "Unexpected end of JSON input".
		*/
		const api$10 = createLineApi(API$2, "WorkBuddy");
		/**
		* Reasoning levels the default-effort control may offer.
		*
		* The levels come from what this account's models actually declare — never from
		* the shipped enum alone. The setting is one global default applied to whichever
		* model a conversation uses, so the list is their union; each entry carries the
		* models behind it, and a level only some models accept is labelled as such.
		* Order follows {@link WORKBUDDY_REASONING_EFFORTS}, which is the escalating
		* order the upstream ladder uses.
		*/
		function reasoningEffortChoices(models) {
			const declared = /* @__PURE__ */ new Map();
			for (const model of models) for (const effort of model.reasoningEfforts ?? []) {
				const names = declared.get(effort);
				if (names === void 0) declared.set(effort, [model.name]);
				else names.push(model.name);
			}
			return WORKBUDDY_REASONING_EFFORTS.filter((effort) => declared.has(effort)).map((effort) => ({
				value: effort,
				models: declared.get(effort)
			}));
		}
		/**
		* Whether a saved default is unusable for every model on this account.
		*
		* The adapter drops a level the chosen model does not accept instead of sending
		* it, so a value that no model declares silently does nothing. Reporting it is
		* what keeps that from looking like the setting was applied.
		*/
		function unsupportedReasoningEffort(configured, models) {
			if (configured === null || configured === void 0) return null;
			return models.some((model) => (model.reasoningEfforts ?? []).includes(configured)) ? null : configured;
		}
		/** Defend against a response that omits the arrays the card renders. */
		function normalizeStatus(data) {
			return {
				...data,
				models: Array.isArray(data?.models) ? data.models : [],
				contextWindowOverrides: data?.contextWindowOverrides ?? {},
				accounts: Array.isArray(data?.accounts) ? data.accounts : []
			};
		}
		function useWorkBuddySection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [statusFailed, setStatusFailed] = (0, react.useState)(false);
			const [connection, setConnection] = (0, react.useState)(null);
			const [loginProgress, setLoginProgress] = (0, react.useState)(null);
			const loginIntervalRef = (0, react.useRef)(null);
			const loginTimeoutRef = (0, react.useRef)(null);
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const t = zh$7;
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			const effortChoices = (0, react.useMemo)(() => reasoningEffortChoices(status?.models ?? []), [status?.models]);
			const allModels = status?.models ?? [];
			const poolAccounts = (0, react.useMemo)(() => Array.isArray(status?.accounts) ? status.accounts : [], [status?.accounts]);
			const strayEffort = unsupportedReasoningEffort(status?.defaultReasoningEffort, allModels);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const data = await api$10.request("/status");
					const normalized = normalizeStatus(data);
					setStatus(normalized);
					setStatusFailed(false);
					setContextDrafts(contextDraftsFor(normalized));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(data.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (err) {
					setStatusFailed(true);
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				return () => {
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
					if (loginIntervalRef.current !== null) window.clearInterval(loginIntervalRef.current);
					if (loginTimeoutRef.current !== null) window.clearTimeout(loginTimeoutRef.current);
				};
			}, [loadStatus]);
			const rescan = async () => {
				try {
					setBusy("rescan");
					setError(null);
					const updated = await api$10.request("/rescan", { method: "POST" });
					setStatus(normalizeStatus(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const login = async (region) => {
				try {
					setBusy(`login:${region}`);
					setError(null);
					setLoginProgress(t.loginWaiting);
					const flow = await api$10.request("/accounts/login", {
						method: "POST",
						body: JSON.stringify({ region })
					});
					if (flow.authUrl) window.open(flow.authUrl, "_blank", "noopener,noreferrer");
					if (loginIntervalRef.current !== null) window.clearInterval(loginIntervalRef.current);
					if (loginTimeoutRef.current !== null) window.clearTimeout(loginTimeoutRef.current);
					const timer = window.setInterval(() => {
						(async () => {
							try {
								const poll = await api$10.request("/accounts/login/status");
								if (poll.progress) setLoginProgress(poll.progress);
								if (poll.status === "complete") {
									window.clearInterval(timer);
									loginIntervalRef.current = null;
									if (loginTimeoutRef.current !== null) window.clearTimeout(loginTimeoutRef.current);
									loginTimeoutRef.current = null;
									setBusy(null);
									setLoginProgress(null);
									if (poll.accountId) await api$10.request("/settings", {
										method: "POST",
										body: JSON.stringify({ selectedAccountId: poll.accountId })
									});
									await loadStatus();
									notifyChange();
								} else if (poll.status === "error") {
									window.clearInterval(timer);
									loginIntervalRef.current = null;
									if (loginTimeoutRef.current !== null) window.clearTimeout(loginTimeoutRef.current);
									loginTimeoutRef.current = null;
									setBusy(null);
									setLoginProgress(null);
									setError(poll.error || t.loginFailed);
								}
							} catch {}
						})();
					}, 1500);
					loginIntervalRef.current = timer;
					loginTimeoutRef.current = window.setTimeout(() => {
						window.clearInterval(timer);
						loginIntervalRef.current = null;
						loginTimeoutRef.current = null;
						setBusy(null);
						setLoginProgress(null);
					}, 300 * 1e3);
				} catch (err) {
					setBusy(null);
					setLoginProgress(null);
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			/**
			* One account action, whether it is a pool action (`set-primary`, `hide`) or a
			* credential action (`delete`). The host route dispatches on `action`.
			*/
			const accountAction = async (action, accountId) => {
				try {
					setBusy(`${action}:${accountId}`);
					setError(null);
					const updated = await api$10.request("/accounts/action", {
						method: "POST",
						body: JSON.stringify({
							action,
							accountId
						})
					});
					setStatus(normalizeStatus(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const deleteAccount = async (accountId) => {
				if (!window.confirm(t.deleteConfirm)) return;
				await accountAction("delete", accountId);
			};
			const setStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					const updated = await api$10.request("/accounts/strategy", {
						method: "POST",
						body: JSON.stringify({ strategy })
					});
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const testConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					setConnection(await api$10.request("/connection/test", { method: "POST" }));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const refreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					const updated = await api$10.request("/quota", { method: "POST" });
					setStatus(updated);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const checkinNow = async () => {
				try {
					setBusy("checkin");
					setError(null);
					const updated = await api$10.request("/checkin/now", { method: "POST" });
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const updateCheckin = async (checkin) => {
				try {
					setBusy("checkin");
					setError(null);
					const updated = await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ checkin })
					});
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/** Switch which client identity chat requests present. */
			const updateOutboundIdentity = async (outboundIdentity) => {
				try {
					setBusy("outbound");
					setError(null);
					const updated = await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ outboundIdentity })
					});
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/** Arm, change or clear the local quota guardrails. */
			const updateGuardrails = async (guardrails) => {
				try {
					setBusy("guardrails");
					setError(null);
					const updated = await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ guardrails })
					});
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/** Store the desktop client's at-rest key, which unlocks sealed credentials. */
			const saveAtRestKey = async (key) => {
				try {
					setBusy("atrest");
					setError(null);
					const updated = await api$10.request("/at-rest-key", {
						method: "POST",
						body: JSON.stringify({ key })
					});
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			/** Forget the at-rest key; sealed accounts become unreadable again. */
			const clearAtRestKey = async () => {
				try {
					setBusy("atrest");
					setError(null);
					const updated = await api$10.request("/at-rest-key", { method: "DELETE" });
					setStatus(normalizeStatus(updated));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const toggleModel = async (modelId, enabled) => {
				if (status === null) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = enabled ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				try {
					setBusy(`model:${modelId}`);
					setError(null);
					const normalized = normalizeStatus(await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds: next })
					}));
					setStatus(normalized);
					setContextDrafts(contextDraftsFor(normalized));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const setAllModels = async (enabled) => {
				if (status === null) return;
				try {
					setBusy("models-all");
					setError(null);
					const normalized = normalizeStatus(await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds: enabled ? status.models.map((model) => model.id) : [] })
					}));
					setStatus(normalized);
					setContextDrafts(contextDraftsFor(normalized));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const updateEffort = async (effort) => {
				try {
					setBusy("effort");
					setError(null);
					const updated = await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ defaultReasoningEffort: effort })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const refreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					const normalized = normalizeStatus(await api$10.request("/catalog/refresh", { method: "POST" }));
					setStatus(normalized);
					setContextDrafts(contextDraftsFor(normalized));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const saveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] || "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(`Invalid context capacity: ${raw}`);
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: parsed } })
					});
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear one override; the row falls back to the catalog length. */
			const resetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = normalizeStatus(await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: null } })
					}));
					setStatus(updated);
					setContextDrafts((prev) => {
						const model = updated.models.find((candidate) => candidate.id === modelId);
						return model === void 0 ? prev : {
							...prev,
							[modelId]: formatCapacity(model.defaultContextWindow)
						};
					});
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const resetAllContextWindows = async () => {
				const models = Object.keys(status?.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (!window.confirm(t.contextWindowResetAllConfirm)) return;
				try {
					setBusy("context");
					setError(null);
					const updated = normalizeStatus(await api$10.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) })
					}));
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const updateContextDraft = (modelId, draft) => {
				setContextDrafts((prev) => ({
					...prev,
					[modelId]: draft
				}));
			};
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			const quota = status?.quota;
			const authenticated = status?.authenticated === true;
			return {
				state: {
					status,
					loading,
					busy,
					error,
					connection,
					loginProgress,
					contextDrafts,
					savingModel
				},
				derived: {
					poolAccounts,
					effortChoices,
					allModels,
					strayEffort,
					contextModels,
					overrideCount,
					quota,
					authenticated,
					unreachable: statusFailed && status === null,
					poolLabels: accountPoolLabels(t)
				},
				actions: {
					login,
					rescan,
					accountAction,
					deleteAccount,
					setStrategy,
					testConnection,
					refreshQuota,
					checkinNow,
					updateCheckin,
					toggleModel,
					setAllModels,
					updateEffort,
					refreshCatalog,
					saveContextWindow,
					resetContextWindow,
					resetAllContextWindows,
					updateContextDraft,
					updateOutboundIdentity,
					updateGuardrails,
					saveAtRestKey,
					clearAtRestKey
				}
			};
		}
		//#endregion
		//#region src/client/workbuddy/WorkBuddySection.tsx
		/**
		* The WorkBuddy subscription settings card.
		*
		* Markup only: every piece of state, every effect and every request this card
		* makes lives in 'useWorkBuddySection.ts', which returns one named shape the JSX
		* below reads. The two files are the split of a single 885-line component — the
		* behaviour is unchanged, and this one should stay render-shaped.
		*/
		/**
		* Display label per reasoning level. The locale dictionary only accepts flat
		* string values, so this nested table lives with the control that renders it.
		*/
		const EFFORT_LABELS$2 = {
			none: "Off",
			minimal: "Minimal",
			low: "Low",
			medium: "Medium",
			high: "High",
			xhigh: "X-High",
			max: "Max"
		};
		/**
		* The consumption rate of one model, as the settings row states it.
		*
		* The gateway publishes one rate per region and the official CodeBuddy picker
		* spells it beside a model as `6.67x`; the row uses the same shape behind the
		* section's own label. Which rates reach the row depends on what the card knows
		* about the account, and the two cases are deliberately different:
		*
		* - A KNOWN region shows that region's rate and nothing else. Borrowing the
		*   sibling region's number would state a price this account never pays —
		*   measured 2026-10-09, `deepseek-v4.1-flash` is `0.11` on cn against `0.00`
		*   on intl, and the backends reject a model asked of the wrong region anyway.
		* - An UNKNOWN region (no account read back yet) shows both rates when the
		*   backends disagree, so the row is honest about the range instead of picking
		*   one of them. When they agree there is nothing to disambiguate.
		*
		* The two-region form is assembled entirely from the caller's labels: the
		* qualifier comes from `labels.region(value, key)` and the join from
		* `labels.pair(first, second)`, so the dictionary owns the region nouns, the
		* bracket glyphs AND the separator. Nothing about the two-region string is
		* spelled in this file, which is the point — the glyphs differ per language
		* (`倍率 0.11x（国区） / 0.00x（国际区）` in Chinese,
		* `Multiplier 0.11x (China) / 0.00x (International)` in English) and a
		* separator chosen here would be right in at most one of them.
		*
		* `null` means "this row states no rate"; the caller drops it from the hint
		* array rather than rendering a placeholder, because a guessed rate on a spend
		* figure is worse than a missing one. `'0.00'` is a declaration — this model
		* consumes no allowance — so it renders like any other value.
		*/
		function creditMultiplierHint(credits, region, labels) {
			const rate = (key) => {
				const value = credits?.[key];
				return typeof value === "string" && value !== "" ? value : null;
			};
			if (region !== null) {
				const value = rate(region);
				return value === null ? null : `${labels.multiplier} ${value}x`;
			}
			const cn = rate("cn");
			const intl = rate("intl");
			if (cn === null) return intl === null ? null : `${labels.multiplier} ${intl}x`;
			if (intl === null || intl === cn) return `${labels.multiplier} ${cn}x`;
			return `${labels.multiplier} ${labels.pair(labels.region(`${cn}x`, "cn"), labels.region(`${intl}x`, "intl"))}`;
		}
		/** Mask a UIN so the card shows identity without publishing the full number. */
		function maskUin(uin) {
			if (uin === void 0 || uin === null || uin === "") return "—";
			if (uin.length <= 6) return uin;
			return `${uin.slice(0, 4)}****${uin.slice(-2)}`;
		}
		function WorkBuddySection({ onModelChange, loadModelDirectory }) {
			const { state, derived, actions } = useWorkBuddySection({
				onModelChange,
				loadModelDirectory
			});
			const { status, loading, busy, error, connection, loginProgress, contextDrafts, savingModel } = state;
			const { poolAccounts, effortChoices, allModels, strayEffort, contextModels, overrideCount, quota, authenticated, unreachable, poolLabels } = derived;
			const sealedCount = status?.sealedAccounts ?? 0;
			const { login, rescan, accountAction, deleteAccount, setStrategy, testConnection, refreshQuota, checkinNow, updateCheckin, toggleModel, setAllModels, updateEffort, refreshCatalog, saveContextWindow, resetContextWindow, resetAllContextWindows, updateContextDraft, updateOutboundIdentity, saveAtRestKey, clearAtRestKey, updateGuardrails } = actions;
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [guardrailDrafts, setGuardrailDrafts] = (0, react.useState)({});
			const t = zh$7;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshwb-hub",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshwb-hub",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshwb-hub-bar",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dshwb-hub-sub",
							children: "管理 WorkBuddy（CodeBuddy 订阅）账号池、实时模型目录、每日签到与本地额度护栏。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwb-hub-chip",
							children: "workbuddy-subscription"
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dshwb-zone",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshwb-zone-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwb-zone-tag",
							children: "WorkBuddy 订阅"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwb-zone-desc",
							children: "订阅额度与账号池"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-page",
						children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts: poolAccounts,
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						labels: poolLabels,
						busy,
						showQuota: true,
						onLogin: () => void login("cn"),
						onSetPrimary: (id) => void accountAction("set-primary", id),
						onDelete: (id) => void deleteAccount(id),
						onClearCooldown: (id) => void accountAction("clear-cooldown", id),
						onRelogin: (id) => void accountAction("relogin", id),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-account-add-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								onClick: () => void login("cn"),
								children: busy === "login:cn" ? t.authorizing : t.addCnAccount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								onClick: () => void login("intl"),
								children: busy === "login:intl" ? t.authorizing : t.addIntlAccount
							})]
						}),
						renderAccountActions: (candidate) => candidate.removable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [candidate.hidden === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsha-btn",
							disabled: busy !== null,
							onClick: () => void accountAction("restore", candidate.id),
							children: t.restoreAccount
						}), candidate.hidden !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsha-btn",
							disabled: busy !== null,
							onClick: () => void accountAction("hide", candidate.id),
							children: t.hideAccount
						})] }),
						renderDetails: (candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							candidate.uin ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.uin,
								": ",
								maskUin(candidate.uin)
							] }) : null,
							candidate.accountType ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.accountType,
								": ",
								candidate.accountType
							] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.region,
								": ",
								candidate.region === "intl" ? t.regionIntl : t.regionCn
							] }),
							candidate.domain ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshwb-mono",
								title: `${candidate.domain} · ${candidate.backend ?? ""}`,
								children: candidate.domain
							}) : null,
							candidate.hidden === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.hiddenAccount }) : null
						] }),
						children: [
							unreachable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.routeUnreachable
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t.routeUnreachableHint
							})] }) : null,
							loginProgress ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: loginProgress
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void rescan(),
									children: busy === "rescan" ? t.rescanning : t.rescan
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-label",
								style: { fontWeight: 600 },
								children: t.outboundSection
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.outboundHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: { margin: "10px 0 14px" },
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									value: status?.outboundIdentity ?? "cli",
									disabled: busy !== null,
									onChange: (event) => void updateOutboundIdentity(event.currentTarget.value),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "cli",
											children: t.outboundCli
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "auto",
											children: t.outboundAuto
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "workbuddy",
											children: t.outboundWorkbuddy
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "vscode",
											children: t.outboundVscode
										})
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-label",
								style: {
									fontWeight: 600,
									marginTop: 12
								},
								children: t.guardrailsSection
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.guardrailsHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshwb-fields",
								children: [
									["reserveCredits", t.guardrailsReserve],
									["dailyTokens", t.guardrailsDaily],
									["modelDailyTokens", t.guardrailsModelDaily]
								].map(([field, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dshwb-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dshwb-control",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 0,
											step: 1,
											disabled: busy !== null,
											value: guardrailDrafts[field] ?? String(status?.guardrails?.[field] ?? 0),
											onChange: (event) => {
												const draft = event.currentTarget.value;
												setGuardrailDrafts((prev) => ({
													...prev,
													[field]: draft
												}));
											},
											onBlur: () => {
												const draft = guardrailDrafts[field];
												if (draft === void 0) return;
												setGuardrailDrafts((prev) => {
													const next = { ...prev };
													delete next[field];
													return next;
												});
												const value = Math.floor(Number(draft));
												if (!Number.isFinite(value) || value < 0) return;
												updateGuardrails({ [field]: value });
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: field === "reserveCredits" ? "credits" : "tokens" })]
									})]
								}, field))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-label",
								style: {
									fontWeight: 600,
									marginTop: 12
								},
								children: t.atRestSection
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.atRestHint
							}),
							sealedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t.atRestSealed.replace("{count}", String(sealedCount))
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshwb-inputrow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "password",
										autoComplete: "off",
										spellCheck: false,
										placeholder: t.atRestPlaceholder,
										value: keyDraft,
										disabled: busy !== null,
										onChange: (event) => setKeyDraft(event.currentTarget.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn dsha-btn-primary",
										disabled: busy !== null || keyDraft.trim() === "",
										onClick: () => {
											saveAtRestKey(keyDraft.trim()).then(() => setKeyDraft(""));
										},
										children: busy === "atrest" ? t.saving : t.atRestSave
									}),
									status?.atRestKeySet === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-muted",
										children: t.atRestSaved
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null,
										onClick: () => void clearAtRestKey(),
										children: t.atRestClear
									})] }) : null
								]
							})
						]
					}),
					status?.checkin != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.dailyCheckin })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.checkinHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								style: { marginBottom: 8 },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									style: { fontWeight: 600 },
									children: t.checkinAuto
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: status.checkin.enabled,
									disabled: busy !== null,
									onChange: (event) => void updateCheckin({ enabled: event.currentTarget.checked })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.dailyCheckin
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsha-value",
									children: [
										t.checkinToday.replace("{done}", String(status.checkin.doneToday)).replace("{total}", String(status.checkin.totalAccounts)),
										status.checkin.skippedToday > 0 ? ` · ${t.checkinSkipped.replace("{count}", String(status.checkin.skippedToday))}` : "",
										status.checkin.failedToday > 0 ? ` · ${t.checkinFailed.replace("{count}", String(status.checkin.failedToday))}` : "",
										` · ${status.checkin.lastRunAt === null ? t.checkinNever : t.checkinLastRun.replace("{time}", new Date(status.checkin.lastRunAt).toLocaleString())}`
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void checkinNow(),
									children: busy === "checkin" ? t.checkinRunning : t.checkinNow
								})
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void testConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void refreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map((model) => {
									const multiplier = creditMultiplierHint(model.credits, status?.account?.region ?? null, {
										multiplier: t.creditMultiplier,
										region: (value, key) => t.creditMultiplierRegion.replace("{value}", value).replace("{region}", key === "cn" ? t.regionCn : t.regionIntl),
										pair: (first, second) => t.creditMultiplierPair.replace("{first}", first).replace("{second}", second)
									});
									return {
										id: model.id,
										name: model.name,
										hint: [
											formatCapacity(model.contextWindow),
											model.supportsImage ? t.imageSupport : t.textOnly,
											...model.reasoningEfforts && model.reasoningEfforts.length > 0 ? [model.reasoningEfforts.join("/")] : [],
											...multiplier === null ? [] : [multiplier]
										].join(" · "),
										enabled: model.enabled
									};
								}),
								busy: busy !== null,
								onToggle: (id, enabled) => void toggleModel(id, enabled),
								onToggleAll: (enabled) => void setAllModels(enabled),
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									list: t.modelsSection
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.defaultReasoningEffortHint
									}),
									strayEffort !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.defaultEffortKept
									}) : null
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.defaultReasoningEffort,
									value: status?.defaultReasoningEffort ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										updateEffort(value === "" ? null : value);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t.defaultEffortAuto
										}),
										strayEffort !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: strayEffort,
											children: `${EFFORT_LABELS$2[strayEffort]} (${t.effortUnsupported})`
										}) : null,
										effortChoices.map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: choice.value,
											children: choice.models.length === allModels.length ? EFFORT_LABELS$2[choice.value] : `${EFFORT_LABELS$2[choice.value]} (${choice.models.length}/${allModels.length})`
										}, choice.value))
									]
								})]
							}),
							effortChoices.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.noReasoningModels
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									inputLabel: `${model.name} context window`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: "tokens",
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								onDraftChange: (id, draft) => updateContextDraft(id, draft),
								onCommit: (id) => void saveContextWindow(id),
								onReset: (id) => void resetContextWindow(id),
								onResetAll: () => void resetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void refreshQuota(),
									children: busy === "quota" ? t.refreshingQuota : t.refreshQuota
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: poolLabels.quotaFactsScope
							}),
							!authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.signedOut
							}) : quota === null || quota === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.refreshingQuota : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: quota.packageName || t.quotaPackage }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota.remainingCredits !== null ? `${quota.remainingCredits} ${t.credits}` : "—" })]
									}),
									quota.cycleUsedCredits !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaCycle
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsha-value",
											children: [
												quota.cycleUsedCredits,
												quota.cycleCredits !== null ? ` / ${quota.cycleCredits}` : "",
												` ${t.credits}`
											]
										})]
									}),
									quota.cycleEndsAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaReset
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsha-value",
											children: [formatDate(quota.cycleEndsAt), formatReset(quota.cycleEndsAt) ? ` · ${formatReset(quota.cycleEndsAt)}` : ""]
										})]
									}),
									quota.meters.filter((meter) => meter.remainingFraction === null).map((meter) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-label",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: meter.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: meter.limit ?? "—" })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-meta",
												children: [meter.used !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													meter.used,
													" / ",
													meter.limit ?? "—"
												] }), meter.resetsAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.quotaReset,
													": ",
													formatReset(meter.resetsAt)
												] })]
											}),
											meter.description !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsha-meter-meta",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: meter.description })
											})
										]
									}, meter.id)),
									quota.meters.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-timestamp",
										children: t.updatedAt.replace("{time}", new Date(quota.fetchedAt).toLocaleString())
									})
								]
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
						]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/wb/minimax-code/api.ts
		/**
		* The MiniMax Code routes the settings card consumes.
		*
		* This module used to carry its own reader — the last one left after
		* `common/line-api.ts` took the other nine — and it still carried the predicate
		* the shared reader dropped: a 2xx answer of `{ ok: false, error }` with no
		* `value` was handed back as a payload instead of raising. Delegating is
		* therefore not only de-duplication: it is what makes this line answer a
		* failure exactly like its siblings.
		*
		* The names stay as they were so the hook that consumes them does not have to
		* change with the reader.
		*/
		const api$9 = createLineApi(MINIMAX_CODE_ROUTE_PREFIX, "MiniMax Code");
		api$9.request;
		const get$2 = api$9.get;
		const post$3 = api$9.post;
		function messageOf$2(cause) {
			return cause instanceof Error ? cause.message : String(cause);
		}
		/**
		* The reset-card panel: the cards still held, plus the recent flow.
		*
		* Goes through the shared reader, so a host half that is older than this one
		* produces the reader's "restart DSH" sentence rather than a bare parse crash.
		*/
		function fetchResetCards() {
			return get$2("/reset-cards");
		}
		/**
		* Spend one card.
		*
		* The body carries the `cardId` and nothing else — deliberately. The card's
		* idempotency key is a field the service de-duplicates on, so letting the
		* browser supply one would let a client spend a card it never read. The host
		* looks the card up and sends the key it found.
		*/
		function useResetCard(cardId) {
			return post$3("/reset-cards/use", { cardId });
		}
		//#endregion
		//#region src/client/minimax-code/locales.ts
		const NS_MINIMAX_CODE = "dsh-minimax-code";
		const zh$6 = {
			...accountPoolZh,
			title: "MiniMax Code",
			pageDesc: "登录 MiniMax Code 编程订阅（设备码 OAuth），复用本机 MiniMax Code 的登录态，管理账号、连接与模型。",
			account: "账号",
			signedIn: "已登录",
			signedOut: "未登录",
			accountLabel: "账号标签",
			accountId: "账号 ID",
			email: "邮箱",
			region: "区域",
			regionCn: "中国大陆 (minimax.cn)",
			regionGlobal: "国际 (minimax.io)",
			expiresAt: "令牌到期",
			expiresRemaining: "剩余 {hours} 小时",
			expiresExpired: "已过期",
			expiresHint: "访问令牌约 24 小时有效；Host 会在令牌过期或上游返回 401 时自动刷新。刷新被拒绝时请回到 MiniMax Code 重新登录。",
			signIn: "登录 MiniMax Code",
			signingIn: "正在申请设备码...",
			signOut: "登出",
			cancelSignIn: "取消登录",
			deviceCodeSection: "设备码授权",
			deviceCodeHint: "在浏览器中打开下方链接（用户码已单独列出，可复制），用你的 MiniMax 账号确认授权。",
			userCode: "用户码",
			copyCode: "复制用户码",
			copied: "已复制",
			openSignInPage: "打开授权页面",
			codeExpires: "设备码有效期",
			codeMinutes: "剩余 {minutes} 分钟",
			waitingAuthorization: "等待浏览器授权...",
			loginFailed: "登录失败",
			loginExpired: "设备码已过期，请重新发起登录。",
			loginDenied: "授权被拒绝。",
			logoutOwnedByApp: "当前登录态属于 MiniMax Code 桌面端：本插件复用它并会在需要时续期写回，但不会撤销或删除它（那会把你从正在运行的 MiniMax Code 里踢下线）。请在 MiniMax Code 应用中退出登录。",
			connection: "连接",
			routeOwned: "本插件正在服务该模型路由。",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重新加载。",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			testSuccess: "连接正常",
			testSuccessModel: "连接正常（{model}）",
			testFailed: "连接失败",
			modelsSection: "模型",
			modelsHint: "模型目录由本线路硬编码（MiniMax Code 未开放 /v1/models 接口），当前共 {count} 个可用模型。勾选后模型才会出现在对话页的模型选择列表中；未勾选或关闭下方「启用此供应商」可在列表中隐藏该线路。",
			modelsUnavailable: "暂无可显示的模型。",
			quotaSection: "用量与配额",
			dailyCheckin: "每日签到",
			checkinHint: "用本线路自己的登录态签到（与官方 MiniMax Code 客户端同一条接口）。DSH 启动时自动签到一次，运行期间每 10 分钟补检，进程关闭的当天不会签到。",
			checkinAuto: "自动签到",
			checkinToday: "今日已签 {done}/{total}",
			checkinSkipped: "{count} 个暂不可签",
			checkinFailed: "{count} 个失败",
			checkinStreak: "连续 {days} 天",
			checkinClaimed: "本轮 +{points} 积分",
			checkinLastRun: "上次运行：{time}",
			checkinNever: "尚未运行",
			checkinNow: "立即签到",
			checkinRunning: "签到中…",
			quotaUnavailable: "暂时没有用量数据。",
			quotaNeedsApiKey: "上游拒绝了这个登录态读取用量（官方客户端的用量端点要求带官方客户端标识头，本插件默认不伪造）。请在 MiniMax 控制台的用量条里查看 Token Plan 用量；如果你接受该取舍，可设 DSH_MINIMAX_CODE_QUOTA_ATTRIBUTION=1 后重试。",
			quotaUnreachable: "暂时读不到用量（用量端点未应答），稍后会自动重试。",
			quotaTokenExpired: "读取用量时令牌刚好过期，正在自动续期——账号仍然是登录状态，无需重新登录。",
			quotaStale: "下面是上一次成功读取到的用量（本次刷新未成功），稍后会自动重试。",
			quotaUsedShare: "已用 {percent}%",
			quotaRefresh: "刷新用量",
			quotaRefreshing: "刷新中...",
			resetSection: "限额重置",
			resetHint: "订阅附带的限额重置卡可以立即重置用量限额。请先选择一张卡，再确认消费。",
			resetConfirm: "请选择一张卡并确认消费。完成后会重新读取用量，不会自动重发对话。",
			resetAvailable: "可用重置卡 {count} 张",
			resetNone: "当前没有可用的重置卡。",
			resetUnavailable: "暂时读不到重置卡（未登录，或该账号没有这个功能）。",
			resetExpires: "到期 {time}",
			resetUse: "使用",
			resetUsing: "重置中…",
			resetRefresh: "刷新重置卡",
			resetRefreshing: "读取中…",
			resetFlowTitle: "近 30 天记录",
			resetFlowEmpty: "近 30 天没有重置卡记录。",
			resetFlowGrant: "获得",
			resetFlowUse: "已使用",
			resetOutcomeSuccess: "重置成功。",
			resetOutcomeReplayed: "该卡已使用，限额状态已更新。",
			resetOutcomeUncertain: "结果不确定，请用同一张卡重试确认，不会重复扣卡——换一张卡会真的多消费一张。",
			resetOutcomeExpired: "该卡已过期，无法用于重置；列表已刷新。",
			resetOutcomeNotFound: "该卡不存在或已不可用；列表已刷新。",
			composerLabel: "额度",
			selectAll: "全选",
			unselectAll: "全不选",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考深度",
			defaultReasoningEffortHint: "控制支持推理的模型在未单独指定时的思考强度。",
			defaultEffortAuto: "自动（各模型默认）",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认值来自订阅网关的模型目录（每个模型的真实上下文上限）；可覆盖为自定义容量，该值用于 DSH 的压缩与溢出判断，可输入 1M、512K、200K 等容量。",
			contextWindowNoneEnabled: "尚未勾选任何模型，先在上方「模型」中勾选。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			tokens: "tokens",
			save: "保存",
			saving: "保存中...",
			invalidCapacity: "容量格式无效：{value}",
			thinkingAlwaysOn: "恒定开启（无档位）",
			thinkingToggle: "可关闭",
			thinkingForced: "强制开启（可选档位）",
			capText: "文本",
			capImage: "图片",
			loading: "加载中...",
			unknown: "—"
		};
		const en$6 = {
			...accountPoolEn,
			title: "MiniMax Code",
			pageDesc: "Sign in to the MiniMax Code coding subscription (device-code OAuth) and reuse the local MiniMax Code sign-in to manage the account, connection, and models.",
			account: "Account",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			accountLabel: "Account label",
			accountId: "Account ID",
			email: "Email",
			region: "Region",
			regionCn: "Mainland China (minimax.cn)",
			regionGlobal: "Global (minimax.io)",
			expiresAt: "Token expires",
			expiresRemaining: "{hours} h left",
			expiresExpired: "Expired",
			expiresHint: "The access token lives about 24 hours; the Host refreshes it once it expires or the upstream answers 401. When a refresh is rejected, sign in again from MiniMax Code.",
			signIn: "Sign in to MiniMax Code",
			signingIn: "Requesting a device code...",
			signOut: "Sign out",
			cancelSignIn: "Cancel",
			deviceCodeSection: "Device authorization",
			deviceCodeHint: "Open the link below in a browser (the user code is listed separately so it can be copied) and approve it with your MiniMax account.",
			userCode: "User code",
			copyCode: "Copy user code",
			copied: "Copied",
			openSignInPage: "Open the sign-in page",
			codeExpires: "Device code expires",
			codeMinutes: "{minutes} min left",
			waitingAuthorization: "Waiting for browser authorization...",
			loginFailed: "Sign-in failed",
			loginExpired: "The device code expired — start the sign-in again.",
			loginDenied: "Authorization was denied.",
			logoutOwnedByApp: "This sign-in belongs to the MiniMax Code desktop app. This plugin reuses it and renews it in place when needed, but it will not revoke or delete it (doing so would sign you out of the running MiniMax Code app). Sign out in the MiniMax Code app instead.",
			connection: "Connection",
			routeOwned: "This plugin serves the model route.",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			testSuccess: "Connection OK",
			testSuccessModel: "Connection OK ({model})",
			testFailed: "Connection failed",
			modelsSection: "Models",
			modelsHint: "The catalog is hardcoded on this line (MiniMax Code exposes no /v1/models endpoint): {count} models available. Only checked models appear in the conversation model picker; unchecking or switching off \"Enable this provider\" hides the line from the list.",
			modelsUnavailable: "No model to show yet.",
			quotaSection: "Usage & quota",
			dailyCheckin: "Daily check-in",
			checkinHint: "Signs in with this line’s own credential (the same interface the official MiniMax Code client uses). The host signs in once at startup and re-checks every 10 minutes while running; a day the process never runs is not signed.",
			checkinAuto: "Auto check-in",
			checkinToday: "Checked in today {done}/{total}",
			checkinSkipped: "{count} not claimable yet",
			checkinFailed: "{count} failed",
			checkinStreak: "{days}-day streak",
			checkinClaimed: "+{points} credits this run",
			checkinLastRun: "Last run: {time}",
			checkinNever: "Never run",
			checkinNow: "Check in now",
			checkinRunning: "Checking in…",
			quotaUnavailable: "No usage data yet.",
			quotaNeedsApiKey: "The service refused this sign-in for the usage read (the official client's endpoint expects first-party attribution headers, which this plugin does not forge by default). Check the usage bar in the MiniMax console; if you accept that trade, set DSH_MINIMAX_CODE_QUOTA_ATTRIBUTION=1 and retry.",
			quotaUnreachable: "Usage is temporarily unreadable (the usage endpoint did not answer); this retries on its own.",
			quotaTokenExpired: "The token expired just as usage was being read, and is being renewed automatically. The account is still signed in; no action needed.",
			quotaStale: "Below is the last usage read that succeeded (this refresh failed); it retries on its own.",
			quotaUsedShare: "{percent}% used",
			quotaRefresh: "Refresh usage",
			quotaRefreshing: "Refreshing...",
			resetSection: "Quota reset",
			resetHint: "Reset cards included with the subscription reset a usage limit immediately. Pick one card, then confirm spending it.",
			resetConfirm: "Select a card and confirm spending it. Usage is re-read afterwards; no conversation is resent.",
			resetAvailable: "{count} reset card(s) available",
			resetNone: "No reset card is available right now.",
			resetUnavailable: "Reset cards are unreadable right now (not signed in, or this account does not have the feature).",
			resetExpires: "Expires {time}",
			resetUse: "Use",
			resetUsing: "Resetting…",
			resetRefresh: "Refresh cards",
			resetRefreshing: "Reading...",
			resetFlowTitle: "Last 30 days",
			resetFlowEmpty: "No reset-card activity in the last 30 days.",
			resetFlowGrant: "Granted",
			resetFlowUse: "Used",
			resetOutcomeSuccess: "Reset succeeded.",
			resetOutcomeReplayed: "That card was already used; the limit state has been updated.",
			resetOutcomeUncertain: "The result is uncertain. Retry with the SAME card to confirm — retrying does not spend a second card, switching to another one does.",
			resetOutcomeExpired: "That card has expired and cannot reset the limit; the list has been refreshed.",
			resetOutcomeNotFound: "That card does not exist or is no longer usable; the list has been refreshed.",
			composerLabel: "Quota",
			selectAll: "Select all",
			unselectAll: "Unselect all",
			enhanced: "Enhanced",
			defaultReasoningEffort: "Default reasoning effort",
			defaultReasoningEffortHint: "Thinking strength for reasoning models when the conversation does not pick one.",
			defaultEffortAuto: "Auto (each model default)",
			contextWindowSection: "Model context windows",
			contextWindowHint: "Defaults come from the subscription gateway model directory (each model's real upper bound). Override one to a custom capacity; the value feeds the compression and overflow decisions. Accepts 1M, 512K, 200K and similar.",
			contextWindowNoneEnabled: "No model is checked yet — pick one in \"Models\" above.",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			tokens: "tokens",
			save: "Save",
			saving: "Saving...",
			invalidCapacity: "Invalid capacity: {value}",
			thinkingAlwaysOn: "Always on (no level)",
			thinkingToggle: "Can be disabled",
			thinkingForced: "Forced on (level selectable)",
			capText: "Text",
			capImage: "Image",
			loading: "Loading...",
			unknown: "—"
		};
		const dictionaries$6 = {
			zh: zh$6,
			"zh-CN": zh$6,
			en: en$6,
			"en-US": en$6
		};
		//#endregion
		//#region src/client/minimax-code/useMinimaxCodeSection.ts
		/**
		* The MiniMax Code card's state, effects and actions.
		*
		* Split out of 'MinimaxCodeSection.tsx' so that file is markup and this one is
		* behaviour: what the card tracks, what it derives from a status answer, and
		* every request a control can make. The view reads one named shape — see
		* `MinimaxCodeSectionView` — so the contract between the two is visible here
		* rather than inferred from the JSX.
		*/
		/** The card's own dictionary; stable identity keeps effect dependencies intact. */
		const fallbackTranslate$3 = (key) => zh$6[key];
		/**
		* The shared pool card's labels, resolved through this card's dictionary.
		*
		* The sibling tabs hand the shared card their raw `zh` object, which works because
		* they render `zh` directly. This card renders through a translate function
		* instead, so the same label set is assembled here by looking each key up. It is
		* derived from the shared ZH label object's own keys, so a label added to the
		* shared card cannot be silently missed — the `satisfies` below turns that into a
		* compile error.
		*/
		function accountPoolLabelsFor$2(t) {
			return {
				accountPool: t("accountPool"),
				addAccount: t("addAccount"),
				accountCount: t("accountCount"),
				primaryAccount: t("primaryAccount"),
				activeAccount: t("activeAccount"),
				setPrimary: t("setPrimary"),
				deleteAccount: t("deleteAccount"),
				cooling: t("cooling"),
				cooldownLeft: t("cooldownLeft"),
				clearCooldown: t("clearCooldown"),
				needsRelogin: t("needsRelogin"),
				relogin: t("relogin"),
				rotationStrategy: t("rotationStrategy"),
				strategySequential: t("strategySequential"),
				strategyRoundRobin: t("strategyRoundRobin"),
				strategySticky: t("strategySticky"),
				noAccounts: t("noAccounts"),
				email: t("email"),
				expires: t("expiresAt"),
				lastUsed: t("lastUsed"),
				accountId: t("accountId"),
				accountQuota: t("accountQuota"),
				quotaNone: t("quotaNone"),
				quotaSnapshot: t("quotaSnapshot"),
				quotaResets: t("quotaResets"),
				quotaExhausted: t("quotaExhausted"),
				quotaWindow: t("quotaWindow"),
				quotaUsed: t("quotaUsed"),
				quotaFactsScope: t("quotaFactsScope"),
				composerLabel: t("composerLabel")
			};
		}
		/**
		* One reset-card panel read, defensively shaped.
		*
		* The route is new and the card renders whatever it is handed, so a half that
		* answers something else (a stale host, a route that 404s into an error body the
		* reader already raised) must not turn into a render crash on `cards.length`.
		* A missing list is an empty list, which is also the truthful reading: the user
		* can select nothing and the use button stays disabled.
		*/
		function normalizeResetCards(value) {
			return {
				cards: Array.isArray(value?.cards) ? value.cards : [],
				flows: Array.isArray(value?.flows) ? value.flows : [],
				fetchedAtMs: typeof value?.fetchedAtMs === "number" && Number.isFinite(value.fetchedAtMs) ? value.fetchedAtMs : 0
			};
		}
		/**
		* What the card tells the user after a spend, one sentence per outcome.
		*
		* The six outcomes are not six flavours of the same answer. Two are certain
		* ("done"), two are refusals (the card is gone — re-read the list), and two are
		* `I did not find out`: the service de-duplicates on the card's own key, so
		* retrying THE SAME card costs nothing while picking another one really does
		* spend a second card. That is why the uncertain sentence names the same card.
		*/
		function resetOutcomeNotice(outcome, t) {
			switch (outcome) {
				case "SUCCESS": return t("resetOutcomeSuccess");
				case "REPLAYED": return t("resetOutcomeReplayed");
				case "LOCK_BUSY":
				case "RETRYABLE_FAIL": return t("resetOutcomeUncertain");
				case "EXPIRED": return t("resetOutcomeExpired");
				case "NOT_FOUND": return t("resetOutcomeNotFound");
			}
		}
		/**
		* Whether an outcome leaves the spent card's fate decided.
		*
		* True for the four outcomes that will not change if the user waits: the card is
		* consumed or it is not usable. False for the two uncertain ones — refreshing
		* there would drop the very row the sentence tells the user to retry with.
		*/
		function outcomeIsDecided(outcome) {
			return outcome !== "LOCK_BUSY" && outcome !== "RETRYABLE_FAIL";
		}
		/** Device-code poll cadence. The host owns the real expiry. */
		const LOGIN_POLL_INTERVAL_MS$2 = 2e3;
		function useMinimaxCodeSection({ onModelChange }) {
			const t = fallbackTranslate$3;
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [flow, setFlow] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(false);
			const [connectionNotice, setConnectionNotice] = (0, react.useState)(null);
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [pool, setPool] = (0, react.useState)(void 0);
			const [resetCards, setResetCards] = (0, react.useState)(null);
			const [resetNotice, setResetNotice] = (0, react.useState)(null);
			const [selectedResetCardId, setSelectedResetCardId] = (0, react.useState)(null);
			const quotaFollowUp = (0, react.useRef)(void 0);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const next = await get$2("/status");
					setStatus(next);
					setContextDrafts(contextDraftsFor(next));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(next.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (cause) {
					if (!quiet) setError(messageOf$2(cause));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				loadPool();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") {
						loadStatus(true);
						loadPool();
					}
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			const loginId = flow?.loginId;
			(0, react.useEffect)(() => {
				if (loginId === void 0) return;
				let stopped = false;
				const timer = window.setInterval(() => {
					(async () => {
						try {
							const poll = await post$3("/login/poll", { loginId });
							if (stopped || poll.status === "pending") return;
							stopped = true;
							window.clearInterval(timer);
							setFlow(null);
							if (poll.status === "authenticated") {
								await loadStatus();
								onModelChange?.();
								return;
							}
							setError(poll.status === "expired" ? t("loginExpired") : t("loginDenied"));
						} catch {}
					})();
				}, LOGIN_POLL_INTERVAL_MS$2);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [
				loginId,
				loadStatus,
				onModelChange,
				t
			]);
			/**
			* Fetch the usage snapshot once, the first time the card sees a signed-in
			* account without one.
			*
			* The status route refreshes usage BEHIND its answer, so it never blocks on a
			* network read; that means the very first paint has no snapshot. Asking here
			* fills the section immediately instead of leaving it empty for a whole poll
			* interval. A failure is silent on purpose: the section already explains that no
			* usage is available, and a usage read must never surface as an error banner.
			*/
			const authenticated = status?.authenticated === true;
			const quotaRequested = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (quotaRequested.current || !authenticated || status?.quota !== void 0) return;
				quotaRequested.current = true;
				(async () => {
					try {
						setStatus(await post$3("/quota"));
					} catch {}
				})();
			}, [authenticated, status?.quota]);
			/**
			* Read the reset-card panel.
			*
			* Silent on failure, exactly like the pool read: this feature is absent on
			* accounts that never earned a card, and a settings card must not raise an
			* error banner for a route that has nothing to say.
			*/
			const loadResetCards = (0, react.useCallback)(async () => {
				try {
					setResetCards(normalizeResetCards(await fetchResetCards()));
				} catch {
					setResetCards(null);
				}
			}, []);
			/**
			* The panel is read once the card knows there is an account to read it for.
			*
			* Reads before sign-in answer with a refusal, which is not a state the user
			* can act on, so the read waits for a signed-in account exactly as the usage
			* read below does.
			*/
			(0, react.useEffect)(() => {
				if (!authenticated) return;
				loadResetCards();
			}, [authenticated, loadResetCards]);
			const refreshResetCards = async () => {
				await loadResetCards();
			};
			const selectResetCard = (cardId) => {
				setSelectedResetCardId(cardId);
			};
			/**
			* Spend one card, behind the confirmation the official client asks for.
			*
			* The confirmation lives here rather than in the view because "cancel" must
			* mean no request at all: the card may not even be sent when the user says no.
			* After a decided outcome the panel is re-read so the spent card leaves the
			* list; after an uncertain one it is deliberately left alone, because the row
			* the user is told to retry with is the one that would disappear.
			*/
			const spendResetCard = async (cardId) => {
				if (typeof window !== "undefined" && !window.confirm(t("resetConfirm"))) return;
				try {
					setBusy("reset-card");
					setError(null);
					const result = await useResetCard(cardId);
					setResetCards(normalizeResetCards(result.cards));
					setResetNotice(resetOutcomeNotice(result.outcome, t));
					setSelectedResetCardId(null);
					if (!outcomeIsDecided(result.outcome)) return;
					await loadResetCards();
					await refreshQuota();
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const login = async () => {
				try {
					setBusy("login");
					setError(null);
					setConnectionNotice(null);
					setCopied(false);
					const started = await post$3("/login/start");
					const next = started.login ?? (typeof started.loginId === "string" ? started : void 0);
					if (next === void 0) {
						setError(t("loginFailed"));
						return;
					}
					setFlow(next);
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const cancelLogin = async () => {
				const pending = flow;
				setFlow(null);
				if (pending === null) return;
				try {
					await post$3("/login/cancel", { loginId: pending.loginId });
				} catch (cause) {
					setError(messageOf$2(cause));
				}
			};
			const copyCode = async () => {
				const code = flow?.userCode;
				if (code === void 0 || code === "") return;
				try {
					await navigator.clipboard.writeText(code);
					setCopied(true);
					window.setTimeout(() => setCopied(false), 2e3);
				} catch {}
			};
			const logout = async () => {
				try {
					setBusy("logout");
					setError(null);
					setConnectionNotice(null);
					setFlow(null);
					const result = await post$3("/logout");
					if (result.native === true) setConnectionNotice(result.error ?? t("logoutOwnedByApp"));
					await loadStatus(true);
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
					await loadStatus(true);
				} finally {
					setBusy(null);
				}
			};
			/**
			* Apply one model-selection patch through `/models`.
			*
			* The host owns the selection and answers with the whole fresh status, so the
			* card never guesses which ids ended up enabled.
			*/
			/** Re-read the pool slice, which lives beside the status on its own route. */
			const loadPool = (0, react.useCallback)(async () => {
				try {
					const next = await get$2("/accounts");
					setPool(next);
				} catch {
					setPool(void 0);
				}
			}, []);
			/** Run one account action, then re-read both the pool and the status. */
			const poolAction = async (action, accountId) => {
				try {
					setBusy(action);
					setError(null);
					await post$3("/accounts", {
						action,
						accountId
					});
					await loadPool();
					await loadStatus(true);
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const setStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					await post$3("/accounts", {
						action: "strategy",
						strategy
					});
					await loadPool();
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const applyEnabled = async (enabledModelIds) => {
				try {
					setError(null);
					const updated = await post$3("/models", { enabledModelIds });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				}
			};
			/** Flip the check-in scheduler's own switch, through the same settings route. */
			const setCheckinEnabled = async (enabled) => {
				try {
					setBusy("checkin");
					setError(null);
					const updated = await post$3("/settings", { checkin: { enabled } });
					setStatus(updated);
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			/** Run one check-in pass now: the toggle and the retry cap are bypassed. */
			const runCheckinNow = async () => {
				try {
					setBusy("checkin");
					setError(null);
					const updated = await post$3("/checkin/now");
					setStatus(updated);
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const toggleModel = (modelId, checked) => {
				if (status === null) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = checked ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabled(next);
			};
			const setAllModels = (selectAll) => {
				if (status === null || status.models.length === 0) return;
				applyEnabled(selectAll ? status.models.map((model) => model.id) : []);
			};
			const updateEffort = async (effort) => {
				try {
					setError(null);
					const updated = await post$3("/settings", { defaultReasoningEffort: effort });
					setStatus(updated);
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				}
			};
			const saveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] ?? "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(t("invalidCapacity").replace("{value}", raw));
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await post$3("/settings", { contextWindowOverrides: { [modelId]: parsed } });
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await post$3("/settings", { contextWindowOverrides: { [modelId]: null } });
					setStatus(updated);
					const model = updated.models.find((entry) => entry.id === modelId);
					if (model !== void 0) setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(model.defaultContextWindow)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetAllContextWindows = async () => {
				const ids = Object.keys(status?.contextWindowOverrides ?? {});
				if (ids.length === 0) return;
				try {
					setError(null);
					const updated = await post$3("/settings", { contextWindowOverrides: Object.fromEntries(ids.map((id) => [id, null])) });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$2(cause));
				}
			};
			/** Force one usage read through `/quota` and render the fresh status. */
			const refreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					setStatus(await post$3("/quota"));
				} catch (cause) {
					setError(messageOf$2(cause));
				} finally {
					setBusy(null);
				}
			};
			const testConnection = async () => {
				try {
					setBusy("test");
					setError(null);
					setConnectionNotice(null);
					const result = await post$3("/test");
					if (result.ok === true) {
						setConnectionNotice(result.model === void 0 || result.model === "" ? t("testSuccess") : t("testSuccessModel").replace("{model}", result.model));
						return;
					}
					setConnectionNotice(result.error === void 0 || result.error === "" ? t("testFailed") : `${t("testFailed")}：${result.error}`);
				} catch (cause) {
					setConnectionNotice(`${t("testFailed")}：${messageOf$2(cause)}`);
				} finally {
					setBusy(null);
				}
			};
			const updateContextDraft = (modelId, draft) => {
				setContextDrafts((prev) => ({
					...prev,
					[modelId]: draft
				}));
			};
			const account = status?.account;
			const quota = status?.quota;
			const models = status?.models ?? [];
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			return {
				state: {
					status,
					loading,
					busy,
					error,
					flow,
					copied,
					connectionNotice,
					contextDrafts,
					savingModel,
					pool,
					resetCards,
					resetNotice,
					selectedResetCardId
				},
				derived: {
					authenticated,
					account,
					quota,
					models,
					contextModels,
					overrideCount,
					resetCardList: resetCards?.cards ?? [],
					resetCardFlows: resetCards?.flows ?? [],
					poolLabels: accountPoolLabelsFor$2(t)
				},
				actions: {
					login,
					cancelLogin,
					copyCode,
					logout,
					poolAction,
					setStrategy,
					toggleModel,
					setAllModels,
					setCheckinEnabled,
					runCheckinNow,
					updateEffort,
					saveContextWindow,
					resetContextWindow,
					resetAllContextWindows,
					refreshQuota,
					refreshResetCards,
					selectResetCard,
					useResetCard: spendResetCard,
					testConnection,
					updateContextDraft
				}
			};
		}
		//#endregion
		//#region src/client/minimax-code/MinimaxCodeSection.tsx
		/**
		* The MiniMax Code settings card.
		*
		* Markup only: every piece of state, every effect and every request this card
		* makes lives in 'useMinimaxCodeSection.ts', which returns one named shape the
		* JSX below reads. The two files are the split of a single 915-line component —
		* the behaviour is unchanged, and this one should stay render-shaped.
		*/
		/** Human label per thinking mode, so the card states what the model does. */
		function thinkingLabel(mode, t) {
			if (mode === "always-on") return t("thinkingAlwaysOn");
			if (mode === "forced-effort") return t("thinkingForced");
			return t("thinkingToggle");
		}
		/**
		* Hours still left on the access token, or null once it has run out.
		*
		* MiniMax Code's token lives about 24 hours, so hours are the unit the card
		* reports; a value worth a fraction of an hour keeps one decimal instead of
		* rounding down to 0.
		*/
		function remainingHours(expiresAtMs) {
			if (expiresAtMs === void 0 || !Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
			const hours = (expiresAtMs - Date.now()) / 36e5;
			if (hours <= 0) return null;
			return hours >= 10 ? hours.toFixed(0) : hours.toFixed(1);
		}
		function MinimaxCodeSection({ onModelChange }) {
			const { state, derived, actions } = useMinimaxCodeSection({ onModelChange });
			const { status, loading, busy, error, flow, copied, connectionNotice, contextDrafts, savingModel, pool, resetCards, resetNotice, selectedResetCardId } = state;
			const { authenticated, account, quota, models, contextModels, overrideCount, poolLabels, resetCardList, resetCardFlows } = derived;
			const { login, cancelLogin, copyCode, logout, poolAction, setStrategy, toggleModel, setAllModels, setCheckinEnabled, runCheckinNow, updateEffort, saveContextWindow, resetContextWindow, resetAllContextWindows, refreshQuota, refreshResetCards, selectResetCard, useResetCard, testConnection, updateContextDraft } = actions;
			const t = fallbackTranslate$3;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t("loading")
				})
			});
			const hours = remainingHours(account?.expiresAtMs);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t("pageDesc")
					}),
					pool !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPoolSection, {
						labels: poolLabels,
						accounts: pool.accounts,
						rotationStrategy: pool.rotationStrategy,
						...pool.activeAccountId === void 0 ? {} : { activeAccountId: pool.activeAccountId },
						busy,
						onLogin: () => void login(),
						onSetPrimary: (accountId) => void poolAction("set-primary", accountId),
						onDelete: (accountId) => void poolAction("delete", accountId),
						onClearCooldown: (accountId) => void poolAction("clear-cooldown", accountId),
						onRelogin: (accountId) => void poolAction("relogin", accountId),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						showQuota: true
					}),
					status?.checkin != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("dailyCheckin") })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("checkinHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								style: { marginBottom: 8 },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									style: { fontWeight: 600 },
									children: t("checkinAuto")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: status.checkin.enabled,
									disabled: busy !== null,
									onChange: (event) => void setCheckinEnabled(event.currentTarget.checked)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t("dailyCheckin")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsha-value",
									children: [
										t("checkinToday").replace("{done}", String(status.checkin.doneToday)).replace("{total}", String(status.checkin.totalAccounts)),
										status.checkin.skippedToday > 0 ? ` · ${t("checkinSkipped").replace("{count}", String(status.checkin.skippedToday))}` : "",
										status.checkin.failedToday > 0 ? ` · ${t("checkinFailed").replace("{count}", String(status.checkin.failedToday))}` : "",
										status.checkin.streakDays !== void 0 ? ` · ${t("checkinStreak").replace("{days}", String(status.checkin.streakDays))}` : "",
										status.checkin.claimedPoints !== void 0 ? ` · ${t("checkinClaimed").replace("{points}", String(status.checkin.claimedPoints))}` : "",
										` · ${status.checkin.lastRunAt === null ? t("checkinNever") : t("checkinLastRun").replace("{time}", formatDate(status.checkin.lastRunAt))}`
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void runCheckinNow(),
									children: busy === "checkin" ? t("checkinRunning") : t("checkinNow")
								})
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("account") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: authenticated ? t("signedIn") : t("signedOut")
								})]
							}),
							authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t("accountLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: account?.label !== void 0 && account.label !== "" ? account.label : t("unknown")
									})]
								}),
								account?.id !== void 0 && account.id !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t("accountId")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value dshm-mono",
										children: account.id
									})]
								}),
								account?.email !== void 0 && account.email !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t("email")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: account.email
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t("expiresAt")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsha-value",
										children: [formatDate(account?.expiresAtMs), hours === null ? ` · ${t("expiresExpired")}` : ` · ${t("expiresRemaining").replace("{hours}", hours)}`]
									})]
								})
							] }),
							status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t("region")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: status.region === "global" ? t("regionGlobal") : t("regionCn")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t("expiresHint")
							})] }),
							flow !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-device-box",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("deviceCodeSection") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("deviceCodeHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-code-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-code",
											"aria-label": t("userCode"),
											children: flow.userCode
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dsha-btn",
											onClick: () => void copyCode(),
											children: copied ? t("copied") : t("copyCode")
										})]
									}),
									flow.verificationUri !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										className: "dsha-link",
										href: flow.verificationUri,
										target: "_blank",
										rel: "noreferrer noopener",
										children: flow.verificationUri
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t("codeExpires")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: t("codeMinutes").replace("{minutes}", String(Math.max(1, Math.round(flow.expiresInSec / 60))))
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t("waitingAuthorization")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-actions",
										children: [flow.verificationUri !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: "dsha-btn",
											href: flow.verificationUri,
											target: "_blank",
											rel: "noreferrer noopener",
											children: t("openSignInPage")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dsha-btn",
											onClick: () => void cancelLogin(),
											children: t("cancelSignIn")
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-actions",
								children: [flow === null && !authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn dsha-btn-primary",
									disabled: busy !== null,
									onClick: () => void login(),
									children: busy === "login" ? t("signingIn") : t("signIn")
								}), flow === null && authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || status?.ownedByPlugin === false,
									title: status?.ownedByPlugin === false ? t("logoutOwnedByApp") : void 0,
									onClick: () => void logout(),
									children: t("signOut")
								})]
							}),
							flow === null && authenticated && status?.ownedByPlugin === false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("logoutOwnedByApp")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("connection") })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t("routeConflict").replace("{detail}", status.conflict) : t("routeOwned")
							}),
							connectionNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: connectionNotice
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void testConnection(),
									children: busy === "test" ? t("testingConnection") : t("testConnection")
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("modelsSection") })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("modelsHint").replace("{count}", String(models.length))
							}),
							models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t("modelsUnavailable")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: models.map((model) => ({
									id: model.id,
									name: model.name,
									hint: [thinkingLabel(model.thinking, t), ...model.description === null || model.description === "" ? [] : [model.description]].join(" · ") || void 0,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t("selectAll"),
									clearAll: t("unselectAll"),
									list: t("modelsSection")
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("enhanced") })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-pref-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("defaultReasoningEffort") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("defaultReasoningEffortHint")
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsha-select",
								"aria-label": t("defaultReasoningEffort"),
								value: status?.defaultReasoningEffort ?? "",
								disabled: busy !== null,
								onChange: (event) => {
									const value = event.currentTarget.value;
									updateEffort(value === "" ? null : value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("defaultEffortAuto")
								}), MINIMAX_CODE_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: effort,
									children: effort
								}, effort))]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("contextWindowSection") })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("contextWindowHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									meta: model.defaultContextWindow < model.contextWindow ? formatCapacity(model.contextWindow) : void 0,
									inputLabel: `${model.name} ${t("contextWindowSection")}`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t("tokens"),
									save: t("save"),
									saving: t("saving"),
									reset: t("contextWindowReset"),
									resetAll: t("contextWindowResetAll"),
									empty: t("contextWindowNoneEnabled")
								},
								busy: busy !== null,
								overrideCount,
								metaClassName: "dsha-model-meta",
								onDraftChange: (id, draft) => updateContextDraft(id, draft),
								onCommit: (id) => void saveContextWindow(id),
								onReset: (id) => void resetContextWindow(id),
								onResetAll: () => void resetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("quotaSection") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void refreshQuota(),
									children: busy === "quota" ? t("quotaRefreshing") : t("quotaRefresh")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("quotaFactsScope")
							}),
							quota === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice dshm-quota-note",
								children: status?.quotaUnavailable === "credential-not-accepted" ? t("quotaNeedsApiKey") : status?.quotaUnavailable === "unreachable" ? t("quotaUnreachable") : status?.quotaUnavailable === "token-expired" ? t("quotaTokenExpired") : t("quotaUnavailable")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-quota-title",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: quota.label }), quota.usedPercent !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("quotaUsedShare").replace("{percent}", String(Math.round(quota.usedPercent))) })]
								}), status?.quotaUnavailable === "stale" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-notice dshm-quota-note",
									children: t("quotaStale")
								})]
							})
						]
					}),
					resetCards !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("resetSection") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void refreshResetCards(),
									children: busy === "reset-card" ? t("resetRefreshing") : t("resetRefresh")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t("resetHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t("resetAvailable").replace("{count}", String(resetCardList.length))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: formatDate(resetCards.fetchedAtMs)
								})]
							}),
							resetCardList.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t("resetNone")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshm-reset-list",
								children: resetCardList.map((card) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row dshm-reset-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsha-btn dshm-reset-pick",
										"aria-pressed": selectedResetCardId === card.cardId,
										disabled: busy !== null,
										onClick: () => selectResetCard(selectedResetCardId === card.cardId ? null : card.cardId),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dshm-mono",
											children: card.cardId
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: t("resetExpires").replace("{time}", formatDate(card.expiresAtMs))
									})]
								}, card.cardId))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice dshm-quota-note",
								children: t("resetConfirm")
							}),
							resetNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice dshm-quota-note",
								role: "status",
								children: resetNotice
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn dsha-btn-primary",
									disabled: busy !== null || selectedResetCardId === null,
									onClick: () => {
										if (selectedResetCardId !== null) useResetCard(selectedResetCardId);
									},
									children: busy === "reset-card" ? t("resetUsing") : t("resetUse")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dshm-quota-note",
								children: t("resetFlowTitle")
							}),
							resetCardFlows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t("resetFlowEmpty")
							}) : resetCardFlows.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: entry.eventType === "GRANT" ? t("resetFlowGrant") : t("resetFlowUse")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsha-value dshm-mono",
									children: [
										entry.cardId,
										" · ",
										formatDate(entry.createdAtMs)
									]
								})]
							}, `${entry.cardId}:${entry.createdAtMs}:${index}`))
						]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/client/glm-coding-plan/locales.ts
		/**
		* GLM（ZCode 账号）线路的客户端命名空间。
		*
		* 与其余每条线路一个命名空间：卡片渲染自己的字典，不复用 hub 挂在
		* `settings.section` 上的那张座位（那张座绑定的是 ChatGPT 的键集，
		* 键名重合的会被渲染成 ChatGPT 的措辞，不重合的会把键名本身打印出来）。
		*/
		const NS_GLM_CODING_PLAN = "dsh-glm-coding-plan";
		const zh$5 = {
			...accountPoolZh,
			title: "GLM（ZCode 账号）",
			pageDesc: "用 ZCode 账号授权接入 GLM Coding Plan（国区 bigmodel.cn / 国际区 z.ai），管理账号池、套餐额度与模型勾选。两个区域的凭据各自独立，池内可以同时存在两区账号。",
			loading: "加载中...",
			region: "区域",
			regionCn: "国区（bigmodel.cn）",
			regionIntl: "国际区（z.ai）",
			regionHint: "下方账号区的全部登录入口都按这里选定的区域发起：「添加账号」按它打开授权页，「导入本机登录态」与「手工粘贴授权码」也落在它那一区。区域是凭据的属性，一区铸造的 Key 会被另一区拒绝，所以两区账号互不串用。",
			authorizing: "授权中…",
			loginIdle: "尚未开始登录。",
			loginHaveAccounts: "号池里已有 {count} 个账号可用。要再加一个就点上面的「添加账号」。",
			loginPending: "等待浏览器完成登录与授权，然后本卡片会自动继续。",
			loginComplete: "登录完成，账号已加入号池。",
			loginCompletedAt: "完成时间：{time}",
			loginCompleteNoAccount: "这次登录完成了，但号池里已经没有这个账号（可能已被删除）。",
			loginError: "登录失败。",
			loginRetryable: "这是可重试的失败，可以直接重新发起一次登录。",
			loginNotRetryable: "这次失败不会自己好：请检查区域是否选对、网络是否可达，然后重新发起登录。",
			authorizeUrl: "授权页面",
			openAuthorizeUrl: "打开授权页面",
			pollEvery: "每 {seconds} 秒查询一次登录结果。",
			loginExpiresAt: "本次授权最长可用到 {time}，过期后需要重新发起。",
			progress: "进度",
			restartLogin: "重新发起登录",
			cancelLogin: "取消登录",
			cancelLoginBusy: "取消中…",
			manualPasteSection: "手工粘贴授权码",
			manualPasteHint: "浏览器回调被拦截、或授权页拿不到 code 时，把 ZCode 回调里的授权码粘贴到下面即可完成兑换——这条兜底通道是回调走不通时唯一能完成登录的地方，所以它一直在，只是没有进行中的流程时默认收起，流程一开始（进行中或失败）就自动展开。",
			manualPastePlaceholder: "粘贴授权码（code=… 或整段回调地址）",
			manualPasteSubmit: "提交授权码",
			manualPasteSubmitting: "兑换中…",
			manualPasteEmpty: "请先粘贴授权码。",
			adopt: "导入本机 ZCode 登录态",
			adopting: "导入中…",
			adoptAdopted: "已导入本机 ZCode 的登录态（{region}），无需重新登录。",
			adoptNoAttempt: "本机没有可导入的 ZCode 登录态。",
			adoptNoCredentialsFile: "没有找到 ZCode 的凭据文件（默认 ~/.zcode/v2/credentials.json）。装过 ZCode 客户端并登录过一次才会有这个文件。",
			adoptSecretUnavailable: "找到了凭据文件，但本机设置了 ZCODE_CREDENTIAL_SECRET，本插件无法推导解密密钥，因此读不出里面的登录态。",
			adoptDecryptFailed: "凭据解密失败，文件可能已被改动或损坏。",
			adoptTokenExpired: "ZCode 的登录态已经过期，回 ZCode 客户端重新登录后再导入。",
			adoptExchangeFailed: "兑换 Coding Plan Key 失败：这个账号可能没有 Coding Plan 套餐，或没有建 Key 的权限。",
			adoptNotAZcodeLogin: "凭据文件里没有本线路认识的 ZCode 登录态（该文件也可能属于别的工具）。",
			adoptFallback: "导入只是省一次登录的快捷路径，失败不影响使用——请改用浏览器登录或手工粘贴授权码。",
			adoptedBadge: "导入的登录态",
			connection: "连接",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			testSuccess: "连通正常",
			testSuccessAccount: "连通正常（账号 {account}）",
			testSuccessModel: "连通正常（{model}）",
			testFailed: "连接测试失败",
			testFailedDetail: "连接测试失败：{detail}",
			testLatency: "往返 {ms} 毫秒",
			routeOwned: "本插件正在服务该模型路由。",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重新加载。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中；目录与能力说明来自本线路的随包目录，**不从模型名推断**（glm-5.3 与 glm-5.3-flash 的图片输入、glm-5.2 与 glm-5.3 的思考档位都不同）。目录按账号所在区域过滤，跨区调用会被上游拒绝。",
			modelsUnavailable: "暂无可显示的模型。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			dismiss: "知道了",
			selectAll: "全选",
			unselectAll: "全不选",
			modelChecklistCount: "{count}/{total}",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认值来自随包目录（每个模型的真实上下文上限）；可覆盖为自定义容量，该值用于 DSH 的压缩与溢出判断，可输入 1M、512K、200K 等容量。",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			tokens: "tokens",
			save: "保存",
			saving: "保存中...",
			saved: "已保存",
			invalidCapacity: "容量格式无效：{value}",
			quotaSection: "用量与配额",
			quotaDesc: "数据来自 Coding Plan 的配额接口，页面可见时最多每 60 秒刷新一次。",
			quotaRefresh: "刷新用量",
			quotaRefreshing: "刷新中...",
			quotaSignedOut: "未登录，先在上方完成登录授权。",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaPlan: "套餐",
			quotaPlanLevel: "档位",
			quotaRenews: "续费时间",
			quotaReadAt: "读取时间",
			quotaSources: "数据源",
			quotaRefreshingNote: "正在后台刷新配额，下方是上一次读到的数字。",
			quotaErrorLabel: "配额读取失败",
			quotaAllowance: "额度类型",
			quotaAllowancePlan: "付费套餐",
			quotaAllowanceFreeTrial: "免费体验额度",
			quotaAllowanceUnknown: "未判定",
			quotaAllowanceHint: "登录时探活认定的额度来源。「免费体验额度」指新用户注册后自动获得、首次使用起 5 天内每天 800 万 token 的体验额度。"
		};
		const en$5 = {
			...accountPoolEn,
			title: "GLM (ZCode account)",
			pageDesc: "Sign in with a ZCode account to reach GLM Coding Plan (China bigmodel.cn / International z.ai), and manage the account pool, plan quota and model selection. The two regions hold independent credentials, so a pool can carry accounts from both.",
			loading: "Loading...",
			region: "Region",
			regionCn: "China (bigmodel.cn)",
			regionIntl: "International (z.ai)",
			regionHint: "Every sign-in entry point in the account section below starts on the region chosen here: “Add Account” opens its authorization page there, and “Import the local sign-in” and the manual code paste both land in that region. A region is a property of the credential — a key minted in one region is refused by the other — so the two never share.",
			authorizing: "Authorizing…",
			loginIdle: "No sign-in started yet.",
			loginHaveAccounts: "The pool already holds {count} account(s), ready to use. To add another, choose “Add Account” above.",
			loginPending: "Finish sign-in and authorization in the browser; this card then continues on its own.",
			loginComplete: "Signed in — the account joined the pool.",
			loginCompletedAt: "Signed in at {time}",
			loginCompleteNoAccount: "That sign-in completed, but the account is no longer in the pool (it may have been deleted).",
			loginError: "Sign-in failed.",
			loginRetryable: "This failure is retryable: start a fresh sign-in.",
			loginNotRetryable: "This failure will not resolve itself: check that the region is right and the network is reachable, then start again.",
			authorizeUrl: "Authorization page",
			openAuthorizeUrl: "Open the authorization page",
			pollEvery: "Polling for the result every {seconds}s.",
			loginExpiresAt: "This authorization is valid until {time}; after that a new one must be started.",
			progress: "Progress",
			restartLogin: "Start again",
			cancelLogin: "Cancel sign-in",
			cancelLoginBusy: "Cancelling…",
			manualPasteSection: "Paste the code by hand",
			manualPasteHint: "When the browser callback is blocked or the page never yields a code, paste the authorization code from the ZCode callback below and the exchange finishes — this fallback is the only way a blocked sign-in can still finish, so it is always here: collapsed while no flow is running, expanded on its own once one starts (pending or failed).",
			manualPastePlaceholder: "Paste the code (code=… or the whole callback URL)",
			manualPasteSubmit: "Submit the code",
			manualPasteSubmitting: "Exchanging…",
			manualPasteEmpty: "Paste a code first.",
			adopt: "Import the local ZCode sign-in",
			adopting: "Importing…",
			adoptAdopted: "Imported the local ZCode sign-in ({region}); no sign-in needed.",
			adoptNoAttempt: "There is no local ZCode sign-in to import.",
			adoptNoCredentialsFile: "No ZCode credentials file found (by default ~/.zcode/v2/credentials.json). It exists once the ZCode client has been installed and signed into.",
			adoptSecretUnavailable: "The credentials file exists, but this machine sets ZCODE_CREDENTIAL_SECRET, so the decryption key cannot be derived and the sign-in inside it cannot be read.",
			adoptDecryptFailed: "Decryption failed; the file may have been edited or damaged.",
			adoptTokenExpired: "The ZCode sign-in has expired — sign in again in the ZCode client and import once more.",
			adoptExchangeFailed: "Exchanging the Coding Plan key failed: this account may have no Coding Plan, or no permission to create a key.",
			adoptNotAZcodeLogin: "The credentials file holds no ZCode sign-in this line recognizes (it may belong to another tool).",
			adoptFallback: "Importing only saves you one sign-in; a failure never blocks the line — use the browser sign-in or the manual code paste instead.",
			adoptedBadge: "Imported sign-in",
			connection: "Connection",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			testSuccess: "Connection OK",
			testSuccessAccount: "Connection OK (account {account})",
			testSuccessModel: "Connection OK ({model})",
			testFailed: "Connection test failed",
			testFailedDetail: "Connection test failed: {detail}",
			testLatency: "{ms} ms round trip",
			routeOwned: "This plugin serves the model route.",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			modelsSection: "Models",
			modelsHint: "Only checked models appear in the conversation model picker. The catalog and every capability sentence come from this line's bundled directory and are never inferred from a model name (GLM-5.3 and GLM-5.3-Flash differ in image input, GLM-5.2 and GLM-5.3 in thinking levels). The catalog is filtered by the account's region; the upstream rejects a model asked of the wrong region.",
			modelsUnavailable: "No model to show yet.",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			dismiss: "Dismiss",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			modelChecklistCount: "{count}/{total}",
			contextWindowSection: "Model context windows",
			contextWindowHint: "Defaults come from the bundled directory (each model's real context cap). Override one with the capacity DSH should use for compaction and overflow decisions; 1M, 512K, 200K and similar are accepted.",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			tokens: "tokens",
			save: "Save",
			saving: "Saving...",
			saved: "Saved",
			invalidCapacity: "Invalid capacity: {value}",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the Coding Plan quota endpoint; refreshes at most once every 60 seconds while visible.",
			quotaRefresh: "Refresh usage",
			quotaRefreshing: "Refreshing...",
			quotaSignedOut: "Not signed in — finish the sign-in above first.",
			quotaEmpty: "No quota data yet — use “Refresh usage” to retry.",
			quotaPlan: "Plan",
			quotaPlanLevel: "Tier",
			quotaRenews: "Renews",
			quotaReadAt: "Read at",
			quotaSources: "Sources",
			quotaRefreshingNote: "Quota is refreshing in the background; the figures below are the last read.",
			quotaErrorLabel: "Quota read failed",
			quotaAllowance: "Allowance",
			quotaAllowancePlan: "Paid plan",
			quotaAllowanceFreeTrial: "Free trial allowance",
			quotaAllowanceUnknown: "Undetermined",
			quotaAllowanceHint: "The allowance source established by the sign-in probe. “Free trial allowance” means 8M tokens per day for 5 days from first use, granted automatically to new accounts."
		};
		const dictionaries$5 = {
			zh: zh$5,
			"zh-CN": zh$5,
			en: en$5,
			"en-US": en$5
		};
		/** 一个配额窗口的键到「窗口长度（分钟）」的映射。 */
		const QUOTA_WINDOW_MINUTES$1 = {
			"five-hour": 300,
			weekly: 10080,
			monthly: 43200
		};
		/** reason → 字典键。一个 reason 一种文案，因此这里是封闭映射而不是兜底串。 */
		const ADOPT_REASON_KEYS$1 = {
			"no-credentials-file": "adoptNoCredentialsFile",
			"secret-unavailable": "adoptSecretUnavailable",
			"decrypt-failed": "adoptDecryptFailed",
			"token-expired": "adoptTokenExpired",
			"exchange-failed": "adoptExchangeFailed",
			"not-a-zcode-login": "adoptNotAZcodeLogin"
		};
		function adoptReasonText$1(reason, dictionary) {
			return dictionary[ADOPT_REASON_KEYS$1[reason]];
		}
		/** 额度类型 → 字典键。三个取值各有各的话，刻意不做兜底串。 */
		const ALLOWANCE_KINDS = {
			plan: "quotaAllowancePlan",
			"free-trial": "quotaAllowanceFreeTrial",
			unknown: "quotaAllowanceUnknown"
		};
		/**
		* 额度类型的本地化文案。
		*
		* `undefined`（旧 host 没下发这个字段）与 `'unknown'` 都渲染成「未判定」：
		* 读不到就等于不知道，而「不知道」不能被渲染成付费套餐。
		*/
		function allowanceKindText(allowance, dictionary) {
			return dictionary[ALLOWANCE_KINDS[allowance ?? "unknown"]];
		}
		//#endregion
		//#region src/client/wb/glm-coding-plan/api.ts
		/**
		* 本线路的 host 路由由这一个文件描述，卡片与输入框胶囊都从这里取。
		*
		* **路由表是与 W6 的约定**：host 侧 src/host/glm-coding-plan/routes.ts 尚未交付，
		* 下表按计划 §6.1（"/wb/glm-coding-plan/api 全套"）与兄弟线路的命名习惯定下，
		* 一旦 host 侧拼写不同，只需要改这一个文件。
		*
		*   GET  /status          → GlmStatusDto（页面的唯一读口）
		*   POST /settings        GlmSettingsUpdateDto → GlmStatusDto（开关、模型勾选、上下文窗口、档位）
		*   POST /accounts        { action, accountId } / { action:'strategy', strategy } → GlmStatusDto
		*   POST /login/start     { region } → GlmLoginFlowStatus
		*   GET  /login/status    → GlmLoginFlowStatus（浏览器授权不由卡片控制，卡片跟随 host）
		*   POST /login/cancel    → GlmLoginFlowStatus
		*   POST /login/manual    { region, code } → GlmStatusDto（手工粘贴兜底；请求体刻意不在冻结契约里）
		*   POST /adopt           { region } → GlmAdoptResultDto（失败永不阻断，卡片据 reason 给文案）
		*   POST /connection/test → GlmConnectionDto
		*   POST /quota           → GlmStatusDto（强制刷新配额）
		*   POST /catalog/refresh → GlmStatusDto
		*
		* 除 adopt 与 connection/test 外，全部走共享的 { ok, value } 信封，
		* 因此答案都是裸 DTO——createLineApi 已经把信封拆掉了。
		*/
		const api$8 = createLineApi(GLM_CODING_PLAN_ROUTE_PREFIX, "GLM（ZCode 账号）");
		const get$1 = api$8.get;
		const post$2 = api$8.post;
		function messageOf$1(cause) {
			return cause instanceof Error ? cause.message : String(cause);
		}
		//#endregion
		//#region src/client/glm-coding-plan/useGlmCodingPlanSection.ts
		/**
		* GLM（ZCode 账号）设置卡片的状态、副作用与动作。
		*
		* 与 WorkBuddy / MiniMax Code 同样的分工：这个文件是行为，GlmCodingPlanSection.tsx
		* 是渲染，两者之间只通过下面这一个具名结构交接，卡片因此保持「只画」的状态。
		*
		* 一条设计约束贯穿全文件：**能力与文案都不在本文件重算**。模型行的一句话描述来自
		* 契约里的 GlmModelOption.hint（host 由随包目录生成），配额窗口名由共享配额条按
		* windowDurationMins 本地化；客户端一旦自己推断能力，就等于把「能力不得从模型名推断」
		* 这条规则（计划 §7）重新打开。
		*/
		/** 登录状态机的轮询节奏。真实超时与间隔由 host 拥有，卡片只是跟随。 */
		const LOGIN_POLL_INTERVAL_MS$1 = 2e3;
		/** 本卡片的字典；身份稳定，依赖它的 effect 才不会每次渲染重建。 */
		const fallbackTranslate$2 = (key) => zh$5[key];
		/**
		* 共享账号池卡片需要的标签集，按本卡片的字典逐键查出来。
		*
		* 从共享 ZH 标签对象自身的键推导，因此共享卡片新增一个标签而这里漏掉时
		* 是编译错误，而不是页面上少一句话。
		*/
		function accountPoolLabelsFor$1(t) {
			return {
				accountPool: t("accountPool"),
				addAccount: t("addAccount"),
				accountCount: t("accountCount"),
				primaryAccount: t("primaryAccount"),
				activeAccount: t("activeAccount"),
				setPrimary: t("setPrimary"),
				deleteAccount: t("deleteAccount"),
				cooling: t("cooling"),
				cooldownLeft: t("cooldownLeft"),
				clearCooldown: t("clearCooldown"),
				needsRelogin: t("needsRelogin"),
				relogin: t("relogin"),
				rotationStrategy: t("rotationStrategy"),
				strategySequential: t("strategySequential"),
				strategyRoundRobin: t("strategyRoundRobin"),
				strategySticky: t("strategySticky"),
				noAccounts: t("noAccounts"),
				email: t("email"),
				expires: t("expires"),
				lastUsed: t("lastUsed"),
				accountId: t("accountId"),
				accountQuota: t("accountQuota"),
				quotaNone: t("quotaNone"),
				quotaSnapshot: t("quotaSnapshot"),
				quotaResets: t("quotaResets"),
				quotaExhausted: t("quotaExhausted"),
				quotaWindow: t("quotaWindow"),
				quotaUsed: t("quotaUsed"),
				quotaFactsScope: t("quotaFactsScope"),
				composerLabel: t("composerLabel")
			};
		}
		/**
		* host 下发的号池行 → 契约里带区域的那一行。
		*
		* 冻结契约写的是 `accounts?: PoolAccountSummaryDto[]`（GlmStatusDto 继承的是
		* Partial<AccountPoolStatusDto>），元素类型是最小的 PoolAccountSummaryDto，
		* GlmAccountSummaryDto 是它的**扩展**而不是它的元素类型；契约已冻结，所以这里在
		* 客户端补齐：region 等 host 确实下发的字段原样取，只有缺失时才回落到当前区域。
		*/
		function glmAccounts(status) {
			const fallback = status?.region ?? "cn";
			return (status?.accounts ?? []).map((account) => {
				const extra = account;
				return {
					...account,
					region: isGlmRegion(extra.region) ? extra.region : fallback,
					...extra.organizationId === void 0 ? {} : { organizationId: extra.organizationId },
					...extra.accountName === void 0 ? {} : { accountName: extra.accountName }
				};
			});
		}
		function useGlmCodingPlanSection({ onModelChange } = {}) {
			const t = fallbackTranslate$2;
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [connection, setConnection] = (0, react.useState)(null);
			const [adoptResult, setAdoptResult] = (0, react.useState)(null);
			const [pasteValue, setPasteValue] = (0, react.useState)("");
			const [pasteOpen, setPasteOpen] = (0, react.useState)(false);
			const [region, setRegionState] = (0, react.useState)("cn");
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const regionTouched = (0, react.useRef)(false);
			const quotaFollowUp = (0, react.useRef)(void 0);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const next = await get$1("/status");
					setStatus(next);
					setContextDrafts(contextDraftsFor(next));
					if (!regionTouched.current) setRegionState(next.region);
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(next.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (cause) {
					if (!quiet) setError(messageOf$1(cause));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			const loginStatus = status?.login?.status;
			(0, react.useEffect)(() => {
				if (loginStatus !== "pending") return;
				let stopped = false;
				const timer = window.setInterval(() => {
					(async () => {
						try {
							const poll = await get$1("/login/status");
							if (stopped) return;
							if (poll.status === "complete") {
								setPasteValue("");
								await loadStatus();
								onModelChange?.();
							} else if (poll.status === "error") setError(poll.error ?? t("loginError"));
						} catch {}
					})();
				}, LOGIN_POLL_INTERVAL_MS$1);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [
				loginStatus,
				loadStatus,
				onModelChange,
				t
			]);
			const setRegion = (0, react.useCallback)((next) => {
				regionTouched.current = true;
				setRegionState(next);
			}, []);
			(0, react.useEffect)(() => {
				setPasteOpen(loginStatus === "pending" || loginStatus === "error");
			}, [loginStatus]);
			const login = async (loginRegion) => {
				try {
					setBusy(`login:${loginRegion}`);
					setError(null);
					setConnection(null);
					setPasteValue("");
					const flow = await post$2("/login/start", { region: loginRegion });
					await loadStatus(true);
					if (flow.authorizeUrl !== void 0 && flow.authorizeUrl !== "") try {
						window.open(flow.authorizeUrl, "_blank", "noopener,noreferrer");
					} catch {}
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const cancelLogin = async () => {
				try {
					setBusy("login:cancel");
					setError(null);
					await post$2("/login/cancel", { region });
					await loadStatus(true);
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const submitPaste = async () => {
				if (pasteValue.trim() === "") {
					setError(t("manualPasteEmpty"));
					return;
				}
				try {
					setBusy("login-manual");
					setError(null);
					setStatus(await post$2("/login/manual", {
						region,
						code: pasteValue.trim()
					}));
					setPasteValue("");
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const adopt = async () => {
				try {
					setBusy("adopt");
					setError(null);
					const result = await post$2("/adopt", { region });
					setAdoptResult(result);
					await loadStatus(true);
					if (result.adopted) onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const accountAction = async (action, accountId) => {
				try {
					setBusy(`account:${action}:${accountId}`);
					setError(null);
					setStatus(await post$2("/accounts", {
						action,
						accountId
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const setStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					setStatus(await post$2("/accounts", {
						action: "strategy",
						strategy
					}));
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			/** 一个模型勾选补丁；host 回整份新状态，卡片因此不必猜哪些 id 最终生效。 */
			const applyEnabledModels = async (enabledModelIds) => {
				try {
					setError(null);
					const updated = await post$2("/settings", { enabledModelIds });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				}
			};
			const toggleModel = (modelId, enabled) => {
				if (status === null) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = enabled ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabledModels(next);
			};
			const setAllModels = (enabled) => {
				if (status === null || status.models.length === 0) return;
				applyEnabledModels(enabled ? status.models.map((model) => model.id) : []);
			};
			const saveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] ?? "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(t("invalidCapacity").replace("{value}", raw));
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					setStatus(await post$2("/settings", { contextWindowOverrides: { [modelId]: parsed } }));
					setContextDrafts((previous) => ({
						...previous,
						[modelId]: formatCapacity(parsed)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await post$2("/settings", { contextWindowOverrides: { [modelId]: null } });
					setStatus(updated);
					const model = updated.models.find((entry) => entry.id === modelId);
					if (model !== void 0) setContextDrafts((previous) => ({
						...previous,
						[modelId]: formatCapacity(model.defaultContextWindow)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetAllContextWindows = async () => {
				const ids = Object.keys(status?.contextWindowOverrides ?? {});
				if (ids.length === 0) return;
				try {
					setError(null);
					const updated = await post$2("/settings", { contextWindowOverrides: Object.fromEntries(ids.map((id) => [id, null])) });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf$1(cause));
				}
			};
			const refreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					setStatus(await post$2("/quota", {}));
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const refreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					setStatus(await post$2("/catalog/refresh", {}));
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const testConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					setConnection(await post$2("/connection/test", {}));
				} catch (cause) {
					setError(messageOf$1(cause));
				} finally {
					setBusy(null);
				}
			};
			const accounts = glmAccounts(status);
			const models = status?.models ?? [];
			const contextModels = models.filter((model) => model.enabled);
			return {
				state: {
					status,
					loading,
					busy,
					error,
					connection,
					adoptResult,
					pasteValue,
					region,
					pasteOpen,
					contextDrafts,
					savingModel
				},
				derived: {
					accounts,
					models,
					contextModels,
					overrideCount: Object.keys(status?.contextWindowOverrides ?? {}).length,
					login: status?.login ?? null,
					quota: status?.quota ?? null,
					authenticated: status?.authenticated === true,
					poolLabels: accountPoolLabelsFor$1(t)
				},
				actions: {
					setRegion,
					login,
					cancelLogin,
					submitPaste,
					setPasteValue,
					togglePaste: () => setPasteOpen((previous) => !previous),
					adopt,
					clearAdoptResult: () => setAdoptResult(null),
					accountAction,
					setStrategy,
					toggleModel,
					setAllModels,
					saveContextWindow,
					resetContextWindow,
					resetAllContextWindows,
					updateContextDraft: (modelId, draft) => {
						setContextDrafts((previous) => ({
							...previous,
							[modelId]: draft
						}));
					},
					refreshQuota,
					refreshCatalog,
					testConnection
				}
			};
		}
		//#endregion
		//#region src/client/glm-coding-plan/GlmCodingPlanSection.tsx
		/**
		* GLM（ZCode 账号）设置卡片。
		*
		* 纯渲染：状态、副作用与请求都在 'useGlmCodingPlanSection.ts'，两者之间只通过
		* 一个具名结构交接（WorkBuddySection / MinimaxCodeSection 同款分工）。
		*
		* 三条需求方的 UI 硬要求由现成共享组件承担，本文件没有新建任何 UI 组件：
		*
		*   1. 进入入口（hub 卡片：图标 + 名称 + 「N 个账号 / M/N 个模型可用」+ 开关 + chevron）
		*      —— hub/providers.tsx 的 descriptor + hub/HubOverview.tsx，点进来就是本卡片；
		*   2. 配额显示额度（标签 + 进度条 + 百分比 + 「N 天后重置」）
		*      —— AccountPoolSection 的 showQuota + common/account-quota.tsx，
		*      窗口名由共享组件按 windowDurationMins 本地化（5 小时 / 1 周 / 1 月），
		*      所以本页的配额区只画「没有账号卡进度条可画」的那些事实；
		*   3. 模型选择（品牌图标 + 模型名 + 一句话描述 + 行尾勾）
		*      —— common/ModelChecklist.tsx，hint 直接用契约里的 GlmModelOption.hint
		*      （host 由随包目录生成，客户端不从模型名推断任何能力）。
		*/
		/** 区域的人类可读名，登录与 adopt 两条入口的结果都要说清楚落在哪一区。 */
		function regionLabel$1(region) {
			return region === "cn" ? zh$5.regionCn : zh$5.regionIntl;
		}
		function GlmCodingPlanSection({ onModelChange } = {}) {
			const { state, derived, actions } = useGlmCodingPlanSection({ onModelChange });
			const { status, loading, busy, error, connection, adoptResult, pasteValue, region, pasteOpen, contextDrafts, savingModel } = state;
			const { accounts, models, contextModels, overrideCount, login, quota, authenticated, poolLabels } = derived;
			const { setRegion, login: startLogin, cancelLogin, submitPaste, setPasteValue, togglePaste, adopt, clearAdoptResult, accountAction, setStrategy, toggleModel, setAllModels, saveContextWindow, resetContextWindow, resetAllContextWindows, updateContextDraft, refreshQuota, refreshCatalog, testConnection } = actions;
			const t = zh$5;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t.pageDesc
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.title })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-pref-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.region }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.regionHint
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsha-select",
								"aria-label": t.region,
								value: region,
								disabled: busy !== null,
								onChange: (event) => setRegion(event.currentTarget.value),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "cn",
									children: t.regionCn
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "intl",
									children: t.regionIntl
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts,
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						labels: poolLabels,
						busy,
						showQuota: true,
						onLogin: () => void startLogin(region),
						onSetPrimary: (accountId) => void accountAction("set-primary", accountId),
						onDelete: (accountId) => void accountAction("delete", accountId),
						onClearCooldown: (accountId) => void accountAction("clear-cooldown", accountId),
						onRelogin: (accountId) => void accountAction("relogin", accountId),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-account-add-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								"aria-label": `${t.addAccount}（${regionLabel$1(region)}）`,
								onClick: () => void startLogin(region),
								children: busy === `login:${region}` ? t.authorizing : t.addAccount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null,
								"aria-label": t.adopt,
								onClick: () => void adopt(),
								children: busy === "adopt" ? t.adopting : t.adopt
							})]
						}),
						renderDetails: (account) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.region,
								": ",
								regionLabel$1(account.region)
							] }),
							account.accountName ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.accountName }) : null,
							account.organizationId ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshglm-mono",
								title: account.organizationId,
								children: account.organizationId
							}) : null
						] }),
						children: [
							login !== null && login.status !== "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshglm-flow",
								children: [
									login.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.loginPending
										}),
										login.authorizeUrl !== void 0 && login.authorizeUrl !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-label",
												children: t.authorizeUrl
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: "dshglm-flow-url",
												children: login.authorizeUrl
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsha-actions",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
													className: "dsha-btn",
													href: login.authorizeUrl,
													target: "_blank",
													rel: "noreferrer noopener",
													children: t.openAuthorizeUrl
												})
											})
										] }),
										login.progress !== void 0 && login.progress !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-label",
												children: t.progress
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-value",
												children: login.progress
											})]
										}),
										login.pollIntervalSec !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.pollEvery.replace("{seconds}", String(login.pollIntervalSec))
										}),
										login.expiresAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.loginExpiresAt.replace("{time}", formatDate(login.expiresAt))
										})
									] }),
									login.status === "complete" && !authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.loginCompleteNoAccount
									}),
									login.status === "complete" && authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsha-notice",
										children: [t.loginComplete, login.email !== void 0 && login.email !== "" ? ` ${login.email}` : ""]
									}), login.completedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.loginCompletedAt.replace("{time}", formatDate(login.completedAt))
									})] }),
									login.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-error",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: login.error !== void 0 && login.error !== "" ? `${t.loginError} ${login.error}` : t.loginError }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: login.retryable === true ? t.loginRetryable : t.loginNotRetryable })]
									}),
									login.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dsha-btn",
											disabled: busy !== null,
											onClick: () => void cancelLogin(),
											children: busy === "login:cancel" ? t.cancelLoginBusy : t.cancelLogin
										})
									})
								]
							}),
							adoptResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: adoptResult.adopted ? t.adoptAdopted.replace("{region}", regionLabel$1(adoptResult.region ?? region)) : adoptResult.reason === void 0 ? t.adoptNoAttempt : `${adoptReasonText$1(adoptResult.reason, t)} ${t.adoptFallback}`
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: clearAdoptResult,
									children: t.dismiss
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshglm-paste",
								children: [
									login !== null && login.status === "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-muted dshglm-paste-note",
										children: authenticated ? t.loginHaveAccounts.replace("{count}", String(accounts.length)) : t.loginIdle
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsha-btn",
										"aria-expanded": pasteOpen,
										"aria-controls": "dshglm-paste-body",
										onClick: togglePaste,
										children: t.manualPasteSection
									}),
									pasteOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshglm-paste-body",
										id: "dshglm-paste-body",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.manualPasteHint
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshglm-paste-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "text",
												className: "dsha-select",
												"aria-label": t.manualPasteSection,
												placeholder: t.manualPastePlaceholder,
												value: pasteValue,
												disabled: busy !== null,
												onChange: (event) => setPasteValue(event.currentTarget.value),
												onKeyDown: (event) => {
													if (event.key === "Enter") submitPaste();
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-btn dsha-btn-primary",
												disabled: busy !== null || pasteValue.trim() === "",
												onClick: () => void submitPaste(),
												children: busy === "login-manual" ? t.manualPasteSubmitting : t.manualPasteSubmit
											})]
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							connection !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: connection.connected ? "dsha-muted" : "dsha-notice",
								children: connection.connected ? [
									t.testSuccess,
									t.testLatency.replace("{ms}", String(connection.latencyMs)),
									connection.account?.alias ?? connection.account?.accountName ?? null,
									connection.model ?? null
								].filter((part) => part !== null && part !== "").join(" · ") : t.testFailedDetail.replace("{detail}", connection.error ?? "—")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void testConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void refreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.modelsUnavailable
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: models.map((model) => ({
									id: model.id,
									name: model.name,
									hint: model.hint === "" ? void 0 : model.hint,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									countTemplate: t.modelChecklistCount,
									list: t.modelsSection
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									meta: model.defaultContextWindow < model.contextWindow ? formatCapacity(model.contextWindow) : void 0,
									inputLabel: `${model.name} ${t.contextWindowSection}`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								metaClassName: "dshglm-model-meta",
								onDraftChange: updateContextDraft,
								onCommit: (id) => void saveContextWindow(id),
								onReset: (id) => void resetContextWindow(id),
								onResetAll: () => void resetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void refreshQuota(),
									children: busy === "quota" ? t.quotaRefreshing : t.quotaRefresh
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: poolLabels.quotaFactsScope
							}),
							status?.quotaRefreshing === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t.quotaRefreshingNote
							}),
							status?.quotaError !== void 0 && status.quotaError !== null && status.quotaError !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: `${t.quotaErrorLabel}: ${status.quotaError}`
							}),
							authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.quotaAllowance
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: allowanceKindText(status?.allowance ?? quota?.allowance, t)
								})]
							}),
							authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaAllowanceHint
							}),
							!authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.quotaSignedOut
							}) : quota === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.quotaRefreshing : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									quota.planLevel !== null && quota.planLevel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: quota.planName ?? t.quotaPlan }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t.quotaPlanLevel,
											": ",
											quota.planLevel
										] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaRenews
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: formatDate(quota.renewsAt)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaReadAt
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: formatDate(quota.fetchedAt)
										})]
									}),
									quota.sources.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaSources
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value dshglm-mono",
											children: quota.sources.join(" · ")
										})]
									}),
									quota.windows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									})
								]
							})
						]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/shared/claude-contracts.ts
		/**
		* Every thinking level this route can name, in escalating order.
		*
		* The union of the whole shipped catalog rather than one model's ladder: these
		* are WIRE effort values, already collapsed by the upstream reference mapping
		* the frozen catalog transcribes ('minimal' and 'low' both send 'low', so
		* offering both would advertise a distinction the wire cannot make). The card
		* offers them as default-effort choices and narrows the dropdown per model with
		* {@link ClaudeModelOption.reasoningEfforts}.
		*
		* 'off' is deliberately absent, exactly as it is from every ladder in the
		* catalog: turning thinking off is the ABSENCE of a thinking block rather than
		* an effort level, and whether a model permits it is stated separately in
		* {@link ClaudeModelOption.canDisableThinking}.
		*
		* NOT derived from the catalog by an indexed access — the client project cannot
		* read that module. The equivalence is asserted against the real table in
		* 'src/host/claude/routes.ts'; see the module comment.
		*/
		const CLAUDE_REASONING_EFFORTS = [
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		//#endregion
		//#region src/client/claude/locales.ts
		/**
		* Locale namespace of the Claude subscription tab.
		*
		* Its own namespace rather than the hub's, so a missing string surfaces as this
		* dictionary's key rather than as a wrong sentence borrowed from another
		* provider — the same reason every sibling line has one.
		*/
		const NS_CLAUDE = "dsh-claude";
		const zh$4 = {
			...accountPoolZh,
			title: "Claude（订阅）",
			pageDesc: "登录 Claude Pro/Max 订阅，管理模型、思考档位、上下文窗口与额度。",
			account: "账号",
			signedIn: "已登录",
			signedOut: "未登录",
			email: "邮箱",
			plan: "套餐",
			planUnknown: "—",
			subscriptionType: "订阅类型",
			source: "来源",
			sourceManaged: "本插件登录",
			sourceClaudeCode: "本机 Claude Code",
			adoptedBadge: "导入的快照",
			signIn: "登录 Claude 账号",
			signInSection: "登录授权",
			signInAgain: "重新登录",
			signingIn: "正在发起登录...",
			cancelSignIn: "取消登录",
			openAuthorizeUrl: "打开授权页面",
			authorizeUrl: "授权链接",
			redirectUri: "回调地址",
			loginModeManual: "当前是手动模式：浏览器回调不可用，授权完成后把页面上的 code 粘贴到下方输入框。",
			loginModeLoopback: "当前是本地回环模式：浏览器授权完成后会自动回到本机回调地址。",
			loginFallbackReason: "本地回环模式不可用，已降级为手动模式：{detail}",
			loginWaiting: "等待浏览器中的授权完成...",
			loginExchanging: "正在交换令牌...",
			loginComplete: "登录完成",
			loginFailed: "登录失败",
			manualPasteSection: "手动粘贴授权码",
			manualPasteHint: "把浏览器地址栏里的 code（或整段回调 URL）粘贴到这里完成登录。手动模式下没有浏览器回调，这里是唯一的入口。",
			manualPastePlaceholder: "code#state 或完整的回调 URL",
			manualPasteSubmit: "提交授权码",
			manualPasteSubmitting: "提交中...",
			importClaudeCode: "导入本机 Claude Code 登录态",
			importing: "导入中...",
			stopImporting: "停止导入",
			connection: "连接",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			testSuccess: "连接正常",
			testLatency: "往返 {ms} ms",
			testFailed: "连接失败：{detail}",
			testRetryable: "可重试",
			testNotRetryable: "不可重试",
			routeOwned: "模型路由由本插件提供",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重试。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			selectAll: "全选",
			unselectAll: "全不选",
			capImage: "图片",
			capNoImage: "仅文本",
			capThinkingOff: "可关闭思考",
			thinkingModeMidConvo: "多轮思考",
			thinkingModeAdaptive: "自适应思考",
			thinkingModeBudget: "预算思考",
			thinkingModeNone: "无思考",
			enhanced: "思考设置",
			defaultReasoningEffort: "默认思考档位",
			defaultReasoningEffortHint: "下拉列出的是目录中出现过的全部档位（含 xhigh）；每个模型真正支持的档位见下方列表，Host 按模型自身的阶梯发送。",
			defaultEffortAuto: "使用模型默认值",
			cacheTtl: "提示缓存时长",
			cacheTtlHint: "Anthropic 提供 5 分钟与 1 小时两档。订阅用户在套餐额度内，官方 Claude Code 对主对话默认使用 1 小时；超出额度改按用量计费后官方会降回 5 分钟。1 小时写入更贵，短会话不划算。",
			cacheTtlSubscription: "跟随官方（订阅默认 1 小时）",
			cacheTtl1h: "1 小时",
			cacheTtl5m: "5 分钟",
			effortLow: "低 (low)",
			effortMedium: "中 (medium)",
			effortHigh: "高 (high)",
			effortXHigh: "极高 (xhigh)",
			effortMax: "最高 (max)",
			modelLadders: "各模型支持的档位",
			modelLadderNone: "该模型不接受思考档位",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认取模型目录的上下文长度，保存过的覆盖值优先。恢复默认会让 Host 删掉这条覆盖值，重新回到目录值。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			contextWindowInvalid: "上下文长度无效：{value}",
			save: "保存",
			saving: "保存中...",
			tokens: "tokens",
			quotaSection: "用量与额度",
			quotaDesc: "数据来自 Claude 用量接口与响应头；页面可见时最多每 60 秒刷新一次。utilization 是「已用百分比」，所以 0% 已用是正常的空用量状态。",
			refreshQuota: "刷新用量",
			refreshingQuota: "刷新中...",
			quotaRefreshing: "Host 正在后台刷新额度，稍后会自动更新。",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaSignedOut: "未登录，无法读取用量。",
			quotaUnknown: "—",
			quotaUnknownHint: "Host 没有给出这个窗口的数值，这里不显示为 0。",
			usedLabel: "已用",
			remainingLabel: "剩余",
			left: "可用",
			resetAt: "重置：{time}",
			resetUnknown: "重置时间未知",
			updatedAt: "更新时间：{time}",
			observedAt: "最近观察：{time}",
			quotaError: "额度读取失败",
			extraUsage: "额外用量",
			extraUsageEnabled: "已开启",
			extraUsageDisabled: "未开启",
			extraUsageLimit: "月度上限",
			sourceUsage: "来源：用量接口",
			sourceHeaders: "来源：响应头",
			quotaStatus: "限流状态",
			quotaRepresentative: "代表性窗口",
			loading: "加载中...",
			now: "即将重置",
			copy: "复制",
			copied: "已复制"
		};
		const en$4 = {
			...accountPoolEn,
			title: "Claude (subscription)",
			pageDesc: "Sign in to a Claude Pro/Max subscription and manage models, thinking levels, context windows and quota.",
			account: "Account",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			email: "Email",
			plan: "Plan",
			planUnknown: "—",
			subscriptionType: "Subscription",
			source: "Source",
			sourceManaged: "Signed in here",
			sourceClaudeCode: "Local Claude Code",
			adoptedBadge: "Imported snapshot",
			signIn: "Sign in to Claude",
			signInSection: "Sign-in",
			signInAgain: "Sign in again",
			signingIn: "Starting the sign-in...",
			cancelSignIn: "Cancel",
			openAuthorizeUrl: "Open the authorization page",
			authorizeUrl: "Authorization URL",
			redirectUri: "Redirect URI",
			loginModeManual: "Manual mode: there is no browser callback, so paste the code shown after authorizing into the box below.",
			loginModeLoopback: "Loopback mode: the browser returns to the local callback automatically after you authorize.",
			loginFallbackReason: "Loopback was unavailable and the flow degraded to manual: {detail}",
			loginWaiting: "Waiting for the browser to finish authorizing...",
			loginExchanging: "Exchanging the token...",
			loginComplete: "Signed in",
			loginFailed: "Sign-in failed",
			manualPasteSection: "Paste the authorization code",
			manualPasteHint: "Paste the code from the browser address bar (or the whole callback URL) here to finish signing in. In manual mode there is no browser callback, so this box is the only way through.",
			manualPastePlaceholder: "code#state or the full callback URL",
			manualPasteSubmit: "Submit code",
			manualPasteSubmitting: "Submitting...",
			importClaudeCode: "Import the local Claude Code sign-in",
			importing: "Importing...",
			stopImporting: "Stop importing",
			connection: "Connection",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			testSuccess: "Connection OK",
			testLatency: "round trip {ms} ms",
			testFailed: "Connection failed: {detail}",
			testRetryable: "retryable",
			testNotRetryable: "not retryable",
			routeOwned: "This plugin serves the model route",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and retry.",
			modelsSection: "Models",
			modelsHint: "Checked models appear in the DSH conversation model list.",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			capImage: "Images",
			capNoImage: "Text only",
			capThinkingOff: "Thinking can be turned off",
			thinkingModeMidConvo: "Mid-conversation thinking",
			thinkingModeAdaptive: "Adaptive thinking",
			thinkingModeBudget: "Budgeted thinking",
			thinkingModeNone: "No thinking",
			enhanced: "Thinking",
			defaultReasoningEffort: "Default thinking level",
			defaultReasoningEffortHint: "The list is every level the catalog names (xhigh included); the per-model ladder is listed below, and the Host sends what that model itself accepts.",
			cacheTtl: "Prompt cache duration",
			cacheTtlHint: "Anthropic offers 5-minute and 1-hour tiers. While a subscription is drawing on included plan usage, the official Claude Code uses the hour for the main conversation; once the plan is exhausted and requests bill against usage credits, it drops back to five minutes. A 1-hour write costs more, so it does not pay off for short sessions.",
			cacheTtlSubscription: "Follow the official (subscription default 1h)",
			cacheTtl1h: "1 hour",
			cacheTtl5m: "5 minutes",
			defaultEffortAuto: "Use the model default",
			effortLow: "Low",
			effortMedium: "Medium",
			effortHigh: "High",
			effortXHigh: "X-High",
			effortMax: "Max",
			modelLadders: "Per-model levels",
			modelLadderNone: "This model accepts no thinking level",
			contextWindowSection: "Model context window",
			contextWindowHint: "Defaults to the catalog context length; a saved override wins. Restoring the default makes the Host delete that override and fall back to the catalog value.",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			contextWindowInvalid: "Invalid context capacity: {value}",
			save: "Save",
			saving: "Saving...",
			tokens: "tokens",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the Claude usage endpoint and response headers; refreshes at most once every 60 seconds while visible. utilization is PERCENT USED, so 0% used is the normal empty state.",
			refreshQuota: "Refresh quota",
			refreshingQuota: "Refreshing...",
			quotaRefreshing: "The Host is refreshing the quota in the background; the numbers update shortly.",
			quotaEmpty: "No quota data yet — use \"Refresh quota\" to retry.",
			quotaSignedOut: "Not signed in, so usage cannot be read.",
			quotaUnknown: "—",
			quotaUnknownHint: "The Host did not state a number for this window, so none is shown instead of a zero.",
			usedLabel: "Used",
			remainingLabel: "Remaining",
			left: "left",
			resetAt: "Reset: {time}",
			resetUnknown: "reset time unknown",
			updatedAt: "Updated at: {time}",
			observedAt: "Last observed: {time}",
			quotaError: "Quota read failed",
			extraUsage: "Extra usage",
			extraUsageEnabled: "enabled",
			extraUsageDisabled: "disabled",
			extraUsageLimit: "Monthly limit",
			sourceUsage: "Source: usage endpoint",
			sourceHeaders: "Source: response headers",
			quotaStatus: "Rate-limit status",
			quotaRepresentative: "Representative window",
			loading: "Loading...",
			now: "now",
			copy: "Copy",
			copied: "Copied"
		};
		const dictionaries$4 = {
			zh: zh$4,
			"zh-CN": zh$4,
			en: en$4,
			"en-US": en$4
		};
		//#endregion
		//#region src/client/claude/useClaudeSection.ts
		/**
		* The Claude card's state, effects and actions.
		*
		* Split out of 'ClaudeSection.tsx' so that file is markup and this one is
		* behaviour: what the card tracks, what it derives from a status answer, and
		* every request a control can make. The view reads one named shape — see
		* `ClaudeSectionView` — so the contract between the two is visible here rather
		* than inferred from a thousand lines of JSX.
		*/
		const api$7 = createLineApi("/wb/claude/api", "Claude");
		/**
		* The poll cadence of a pending sign-in.
		*
		* There is NO SSE channel in this plugin — every sibling line polls
		* 'login/status' on a timer while the user is in the browser, and this one does
		* the same so a stalled flow is visible rather than silent.
		*/
		const LOGIN_POLL_MS = 2e3;
		function useClaudeSection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [flow, setFlow] = (0, react.useState)(null);
			const [pasteValue, setPasteValue] = (0, react.useState)("");
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [connection, setConnection] = (0, react.useState)(null);
			/** Follow-up poll owed while the host refreshes the quota behind an answer. */
			const quotaFollowUp = (0, react.useRef)(null);
			const t = zh$4;
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			/** Report one failure in the card's error strip. */
			const reportError = (0, react.useCallback)((err) => {
				setError(err instanceof Error ? err.message : String(err));
			}, []);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const data = await api$7.request("/status");
					setStatus(data);
					setContextDrafts(contextDraftsFor(data));
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(data.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (err) {
					if (!quiet) reportError(err);
				} finally {
					setLoading(false);
				}
			}, [reportError]);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			(0, react.useEffect)(() => {
				if (flow?.status !== "pending" && flow?.status !== "exchanging") return;
				const timer = window.setInterval(() => {
					(async () => {
						try {
							const poll = await api$7.request("/login/status");
							setFlow(poll);
							if (poll.status === "complete") {
								setPasteValue("");
								await loadStatus();
								notifyChange();
							} else if (poll.status === "error") setError(poll.error || t.loginFailed);
						} catch {}
					})();
				}, LOGIN_POLL_MS);
				return () => window.clearInterval(timer);
			}, [
				flow?.status,
				loadStatus,
				notifyChange,
				t.loginFailed
			]);
			const login = async () => {
				try {
					setBusy("login");
					setError(null);
					setPasteValue("");
					const next = await api$7.request("/login", {
						method: "POST",
						body: JSON.stringify({})
					});
					setFlow(next);
					if (next.authUrl) window.open(next.authUrl, "_blank", "noopener,noreferrer");
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			const cancelLogin = async () => {
				try {
					const next = await api$7.request("/login/cancel", { method: "POST" });
					setFlow(next);
				} catch (err) {
					reportError(err);
				}
			};
			/** Finish a manual-mode sign-in with the code the user pasted. */
			const submitPaste = async () => {
				if (pasteValue.trim() === "") return;
				try {
					setBusy("login-input");
					setError(null);
					const updated = await api$7.request("/login/input", {
						method: "POST",
						body: JSON.stringify({ input: pasteValue })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					setFlow({ status: "idle" });
					setPasteValue("");
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			/**
			* Add the local Claude Code sign-in as a snapshot.
			*
			* The host reads the file; the card only asks for the import.
			*/
			const adopt = async () => {
				try {
					setBusy("adopt");
					setError(null);
					const updated = await api$7.request("/adopt", { method: "POST" });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			/** Forget every imported snapshot, or one of them. Claude Code's file is untouched. */
			const stopImporting = async (accountId) => {
				try {
					setBusy(accountId === void 0 ? "adopt-disable" : `adopt-disable-${accountId}`);
					setError(null);
					const updated = await api$7.request("/adopt/disable", {
						method: "POST",
						body: JSON.stringify(accountId === void 0 ? {} : { accountId })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			/** One account-level action on the shared pool card. */
			const accountAction = async (action, accountId) => {
				try {
					setBusy(`${action}-${accountId}`);
					setError(null);
					const updated = await api$7.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action,
							accountId
						})
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			const setStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					const updated = await api$7.request("/accounts", {
						method: "POST",
						body: JSON.stringify({
							action: "strategy",
							strategy
						})
					});
					setStatus(updated);
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			/**
			* Re-authorize ONE account.
			*
			* Nothing is deleted: the sign-in route is addressed at this account id, so
			* the new credential lands in that row and keeps its alias and place in the
			* rotation. The flow DTO it returns is what starts the polling above.
			*/
			const relogin = (accountId) => {
				(async () => {
					try {
						setBusy(`relogin-${accountId}`);
						setError(null);
						setPasteValue("");
						const next = await api$7.request("/login", {
							method: "POST",
							body: JSON.stringify({ accountId })
						});
						setFlow(next);
						if (next.authUrl) window.open(next.authUrl, "_blank", "noopener,noreferrer");
					} catch (err) {
						reportError(err);
					} finally {
						setBusy(null);
					}
				})();
			};
			const refreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					const updated = await api$7.request("/quota", { method: "POST" });
					setStatus(updated);
				} catch (err) {
					reportError(err);
					await loadStatus(true);
				} finally {
					setBusy(null);
				}
			};
			const refreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					const updated = await api$7.request("/catalog/refresh", { method: "POST" });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			const testConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					setConnection(null);
					const result = await api$7.request("/connection/test", { method: "POST" });
					setConnection(result);
					await loadStatus(true);
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			const applyEnabled = async (enabledModelIds) => {
				try {
					const updated = await api$7.request("/models", {
						method: "POST",
						body: JSON.stringify({ enabledModelIds })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					reportError(err);
				}
			};
			const toggleModel = (modelId, checked) => {
				if (!status) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = checked ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabled(next);
			};
			const setAllModels = (selectAll) => {
				if (!status || status.models.length === 0) return;
				applyEnabled(selectAll ? status.models.map((model) => model.id) : []);
			};
			const updateEffort = async (effort) => {
				try {
					const updated = await api$7.request("/settings", {
						method: "POST",
						body: JSON.stringify({ defaultReasoningEffort: effort })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					reportError(err);
				}
			};
			const updateCacheTtl = async (ttl) => {
				try {
					const updated = await api$7.request("/settings", {
						method: "POST",
						body: JSON.stringify({ cacheTtl: ttl })
					});
					setStatus(updated);
					notifyChange();
				} catch (err) {
					reportError(err);
				}
			};
			const saveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] || "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(t.contextWindowInvalid.replace("{value}", raw));
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$7.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: parsed } })
					});
					setStatus(updated);
					setContextDrafts((prev) => ({
						...prev,
						[modelId]: formatCapacity(parsed)
					}));
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setSavingModel(null);
				}
			};
			/**
			* Clear one override.
			*
			* `null` is the card's "restore the catalog default" and the host preserves
			* it through its own normalization, which is what makes this a delete rather
			* than a save of the default value.
			*/
			const resetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await api$7.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: { [modelId]: null } })
					});
					setStatus(updated);
					setContextDrafts((prev) => {
						const model = updated.models.find((candidate) => candidate.id === modelId);
						return model === void 0 ? prev : {
							...prev,
							[modelId]: formatCapacity(model.defaultContextWindow)
						};
					});
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setSavingModel(null);
				}
			};
			/** Clear every stored override, including models the picker no longer shows. */
			const resetAllContextWindows = async () => {
				const models = Object.keys(status?.contextWindowOverrides ?? {});
				if (models.length === 0) return;
				if (typeof window !== "undefined" && !window.confirm(t.contextWindowResetAllConfirm)) return;
				try {
					setBusy("context");
					setError(null);
					const updated = await api$7.request("/settings", {
						method: "POST",
						body: JSON.stringify({ contextWindowOverrides: Object.fromEntries(models.map((model) => [model, null])) })
					});
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					notifyChange();
				} catch (err) {
					reportError(err);
				} finally {
					setBusy(null);
				}
			};
			const updateContextDraft = (modelId, draft) => {
				setContextDrafts((prev) => ({
					...prev,
					[modelId]: draft
				}));
			};
			const accounts = status?.accounts ?? [];
			const hasAdopted = accounts.some((account) => account.adopted === true || account.removable === false);
			const contextModels = status?.models.filter((model) => model.enabled) ?? [];
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			const quota = status?.quota;
			const windows = quota?.windows ?? [];
			return {
				state: {
					status,
					loading,
					busy,
					error,
					flow,
					connection,
					pasteValue,
					contextDrafts,
					savingModel
				},
				derived: {
					accounts,
					hasAdopted,
					contextModels,
					overrideCount,
					quota,
					windows,
					poolLabels: t
				},
				actions: {
					login,
					cancelLogin,
					submitPaste,
					adopt,
					stopImporting,
					accountAction,
					setStrategy,
					relogin,
					refreshQuota,
					refreshCatalog,
					testConnection,
					toggleModel,
					setAllModels,
					updateEffort,
					updateCacheTtl,
					saveContextWindow,
					resetContextWindow,
					resetAllContextWindows,
					updateContextDraft,
					setPasteValue
				}
			};
		}
		//#endregion
		//#region src/client/claude/ClaudeSection.tsx
		/**
		* The Claude subscription settings card.
		*
		* Markup only: every piece of state, every effect and every request this card
		* makes lives in 'useClaudeSection.ts', which returns one named shape the JSX
		* below reads. The two files are the split of a single 900-line component — the
		* behaviour is unchanged, and this one should stay render-shaped.
		*/
		/**
		* Display label per thinking level.
		*
		* The locale dictionary only accepts flat string values, so this table lives
		* with the control that renders it — the same arrangement every sibling uses.
		* Every level the wire can name is listed, 'xhigh' included: filtering a level
		* out here would hide a choice the host would accept and a catalog may expose.
		*/
		const EFFORT_LABELS$1 = {
			low: zh$4.effortLow,
			medium: zh$4.effortMedium,
			high: zh$4.effortHigh,
			xhigh: zh$4.effortXHigh,
			max: zh$4.effortMax
		};
		/** One-line capability summary shown as a model pill's hover title. */
		function modelFacts(model, t) {
			const thinking = model.thinkingMode === "mid-convo" ? t.thinkingModeMidConvo : model.thinkingMode === "adaptive" ? t.thinkingModeAdaptive : model.thinkingMode === "budget" ? t.thinkingModeBudget : t.thinkingModeNone;
			return [
				model.id,
				model.supportsImage ? t.capImage : t.capNoImage,
				thinking,
				...model.canDisableThinking ? [t.capThinkingOff] : [],
				...model.reasoningEfforts.length > 0 ? [model.reasoningEfforts.join("/")] : []
			];
		}
		function ClaudeSection({ onModelChange, loadModelDirectory }) {
			const { state, derived, actions } = useClaudeSection({
				onModelChange,
				loadModelDirectory
			});
			const { status, loading, busy, error, flow, connection, pasteValue, contextDrafts, savingModel } = state;
			const { accounts, hasAdopted, contextModels, overrideCount, quota, windows, poolLabels } = derived;
			const { login, cancelLogin, submitPaste, adopt, stopImporting, accountAction, setStrategy, relogin, refreshQuota, refreshCatalog, testConnection, toggleModel, setAllModels, updateEffort, updateCacheTtl, saveContextWindow, resetContextWindow, resetAllContextWindows, updateContextDraft, setPasteValue } = actions;
			const t = zh$4;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts,
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						busy,
						labels: poolLabels,
						onLogin: () => void login(),
						onSetPrimary: (accountId) => void accountAction("set-primary", accountId),
						onDelete: (accountId) => void accountAction("delete", accountId),
						onClearCooldown: (accountId) => void accountAction("clear-cooldown", accountId),
						onRelogin: (accountId) => relogin(accountId),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						showQuota: true,
						renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-account-add-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								"aria-label": t.signIn,
								onClick: () => void login(),
								children: busy === "login" ? t.signingIn : t.signIn
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null,
								"aria-label": t.importClaudeCode,
								onClick: () => void adopt(),
								children: busy === "adopt" ? t.importing : t.importClaudeCode
							})]
						}),
						renderAccountActions: (entry) => entry.adopted === true || entry.removable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsha-btn",
							disabled: busy !== null,
							"aria-label": `${t.stopImporting}: ${entry.id}`,
							onClick: () => void stopImporting(entry.id),
							children: busy === `adopt-disable-${entry.id}` ? t.importing : t.stopImporting
						}) : null,
						renderDetails: (entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							entry.planLabel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.plan,
								": ",
								entry.planLabel
							] }),
							entry.subscriptionType && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.subscriptionType,
								": ",
								entry.subscriptionType
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.source,
								": ",
								entry.source === "claude-code" ? t.sourceClaudeCode : t.sourceManaged
							] })
						] }),
						children: [hasAdopted && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null,
								"aria-label": t.stopImporting,
								onClick: () => void stopImporting(),
								children: busy === "adopt-disable" ? t.importing : t.stopImporting
							})
						}), flow !== null && flow.status !== "idle" && flow.status !== "complete" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshcl-flow",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.signInSection }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: flow?.status === "error" ? `${t.loginFailed}: ${flow.error ?? ""}` : flow?.status === "exchanging" ? t.loginExchanging : flow?.mode === "manual" ? t.loginModeManual : t.loginModeLoopback
								}),
								flow?.hint !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: flow.hint
								}),
								flow?.fallbackReason !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-notice",
									children: t.loginFallbackReason.replace("{detail}", flow.fallbackReason)
								}),
								flow?.authUrl !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.authorizeUrl
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
										className: "dshcl-flow-url",
										children: flow.authUrl
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: "dsha-btn",
											href: flow.authUrl,
											target: "_blank",
											rel: "noreferrer noopener",
											children: t.openAuthorizeUrl
										})
									})
								] }),
								flow?.redirectUri !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.redirectUri
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value dshcl-mono",
										children: flow.redirectUri
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshcl-paste",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.manualPasteSection }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.manualPasteHint
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshcl-paste-row",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "text",
													className: "dsha-select",
													"aria-label": t.manualPasteSection,
													placeholder: t.manualPastePlaceholder,
													value: pasteValue,
													disabled: busy !== null,
													onChange: (event) => setPasteValue(event.currentTarget.value),
													onKeyDown: (event) => {
														if (event.key === "Enter") submitPaste();
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn dsha-btn-primary",
													disabled: busy !== null || pasteValue.trim() === "",
													onClick: () => void submitPaste(),
													children: busy === "login-input" ? t.manualPasteSubmitting : t.manualPasteSubmit
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "dsha-btn",
													disabled: busy !== null,
													onClick: () => void cancelLogin(),
													children: t.cancelSignIn
												})
											]
										})
									]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							status?.account !== null && status?.account !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.account
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsha-value",
									children: [status.account.email ?? t.planUnknown, status.account.subscriptionType !== null ? ` · ${status.account.subscriptionType}` : ""]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							connection !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: connection.connected ? "dsha-muted" : "dsha-notice",
								children: connection.connected ? `${t.testSuccess} · ${t.testLatency.replace("{ms}", String(connection.latencyMs))}` : t.testFailed.replace("{detail}", connection.error ?? `HTTP ${connection.status}`) + ` (${connection.retryable ? t.testRetryable : t.testNotRetryable})`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void testConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void refreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map((model) => ({
									id: model.id,
									name: model.name,
									hint: modelFacts(model, t).slice(1).join(" · ") || void 0,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									list: t.modelsSection
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.defaultReasoningEffortHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.defaultReasoningEffort,
									value: status?.defaultReasoningEffort ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										updateEffort(value === "" ? null : value);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t.defaultEffortAuto
									}), CLAUDE_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: effort,
										children: EFFORT_LABELS$1[effort]
									}, effort))]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.cacheTtl }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.cacheTtlHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.cacheTtl,
									value: status?.cacheTtl ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										updateCacheTtl(value === "" ? null : value);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t.cacheTtlSubscription
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "1h",
											children: t.cacheTtl1h
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "5m",
											children: t.cacheTtl5m
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								style: { paddingTop: 10 },
								children: t.modelLadders
							}),
							status?.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: model.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: model.reasoningEfforts.length === 0 ? t.modelLadderNone : model.reasoningEfforts.join(" · ")
								})]
							}, model.id))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									meta: model.defaultContextWindow < model.contextWindow ? formatCapacity(model.contextWindow) : void 0,
									inputLabel: `${model.name} context window`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								metaClassName: "dshcl-model-meta",
								onDraftChange: (id, draft) => updateContextDraft(id, draft),
								onCommit: (id) => void saveContextWindow(id),
								onReset: (id) => void resetContextWindow(id),
								onResetAll: () => void resetAllContextWindows()
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !status?.authenticated,
									onClick: () => void refreshQuota(),
									children: busy === "quota" ? t.refreshingQuota : t.refreshQuota
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaDesc
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaFactsScope
							}),
							status?.quotaRefreshing === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t.quotaRefreshing
							}),
							status?.quotaError !== void 0 && status.quotaError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsha-notice",
								children: [
									t.quotaError,
									": ",
									status.quotaError
								]
							}),
							!status?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.quotaSignedOut
							}) : quota === null || quota === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.refreshingQuota : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: status.account?.subscriptionType ?? t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: status.account?.email ?? t.planUnknown })]
									}),
									quota.extraUsage !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-label",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota.extraUsage.label || t.extraUsage }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: quota.extraUsage.remainingPercent === null ? t.quotaUnknown : `${Math.round(quota.extraUsage.remainingPercent)}% ${t.left}` })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-meter-meta",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.extraUsage,
													": ",
													quota.extraUsage.enabled ? t.extraUsageEnabled : t.extraUsageDisabled
												] }),
												quota.extraUsage.used !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.usedLabel,
													": ",
													quota.extraUsage.used
												] }),
												quota.extraUsage.limit !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t.extraUsageLimit,
													": ",
													quota.extraUsage.limit
												] })
											]
										})]
									}),
									quota.status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaStatus
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: quota.status
										})]
									}),
									quota.representativeClaim !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.quotaRepresentative
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-value",
											children: quota.representativeClaim
										})]
									}),
									windows.length === 0 && quota.extraUsage === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-timestamp",
										children: quota.fetchedAt === null ? t.observedAt.replace("{time}", formatDate(quota.observedAt)) : t.updatedAt.replace("{time}", formatDate(quota.fetchedAt))
									})
								]
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/shared/ollama-contracts.ts
		/**
		* The thinking levels this line's card offers.
		*
		* Deliberately narrower than the union of what every model accepts. Ollama's
		* thinking control comes in three shapes (see {@link thinkingModeForModel} in
		* src/host/ollama/types.ts): gpt-oss takes low/medium/high, the boolean models
		* (deepseek-r1, qwq, qwen3) take only on/off, and every other model takes no
		* thinking control at all. These four strings are the vocabulary both shapes can
		* be expressed with, so one dropdown covers the whole line.
		*
		* Whether a given model can actually honour a level is decided by the host, not
		* by this list: {@link thinkForModel} in src/host/ollama/types.ts drops what a
		* model cannot express, so picking 'high' is safe for a user whose catalog holds
		* a mixture of families.
		*/
		const OLLAMA_REASONING_EFFORTS = [
			"none",
			"low",
			"medium",
			"high"
		];
		//#endregion
		//#region src/client/wb/ollama/api.ts
		const API$1 = "/wb/ollama/api";
		/**
		* The Ollama settings API, as the card uses it.
		*
		* Deliberately the same envelope and the same fetch shape every other provider
		* section uses, so the shared account-pool card and this helper read alike.
		*/
		var OllamaApi = class {
			status() {
				return request(`${API$1}/status`);
			}
			/**
			* One pool action, returning the refreshed status.
			*
			* The host answers with the same envelope the status route uses, so the card
			* never has to guess what the pool looks like after a change.
			*/
			accountAction(action, body = {}) {
				return post$1(`${API$1}/accounts`, {
					action,
					...body
				});
			}
			refreshCatalog() {
				return post$1(`${API$1}/catalog/refresh`, {});
			}
			/**
			* Store the default thinking level, answering with the refreshed status.
			*
			* '/settings' replies with the stored settings document rather than with the
			* status the card renders, so the status is re-read behind the write. That is
			* the same shape {@link refreshCatalog} needs, and it is why the return type is
			* a status: handing the settings document to the renderer would blank the
			* model list the user just configured.
			*
			* null is a real value ('do not specify'), not an absent one, so it is sent
			* explicitly rather than left out of the body.
			*/
			setDefaultReasoningEffort(effort) {
				return post$1(`${API$1}/settings`, { defaultReasoningEffort: effort }).then(() => this.status());
			}
			/**
			* Replace the enabled-model selection.
			*
			* The whole list is sent rather than a single id's new state, because the card
			* offers bulk select and unselect and would otherwise have to read the current
			* selection before it could answer 'turn this one off'.
			*/
			setEnabledModels(enabledModelIds) {
				return post$1(`${API$1}/models`, { enabledModelIds });
			}
		};
		async function post$1(url, body) {
			return request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		async function request(url, init) {
			const response = await fetch(url, {
				...init,
				credentials: "same-origin"
			});
			const envelope = await readEnvelope(response);
			if (!response.ok || !envelope.ok) throw new Error(envelope.error || `HTTP ${response.status}`);
			return envelope.value;
		}
		/**
		* Read the {ok,value,error} envelope, or say why there was not one.
		*
		* `response.json()` is not a way to report an error. A body that is empty —
		* which is what DSH's web server sends for a route handler that rejected, and
		* what a proxy sends for a blocked request — throws the browser's own
		* "Failed to execute 'json' on 'Response': Unexpected end of JSON input" (issue
		* #36), a sentence that names neither the status nor the request. Reading the
		* text first costs one string and turns every unreadable answer into a message
		* that says what the Host actually replied.
		*
		* The body is never echoed back: it can be an HTML page of arbitrary size, and
		* its content-type alone is what identifies the failure.
		*/
		async function readEnvelope(response) {
			let text;
			try {
				text = await response.text();
			} catch (cause) {
				throw new Error(unreadable(response, cause));
			}
			if (text.trim() === "") throw new Error(unreadable(response));
			let parsed;
			try {
				parsed = JSON.parse(text);
			} catch {
				throw new Error(unreadable(response));
			}
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(unreadable(response));
			const envelope = parsed;
			if (typeof envelope.error !== "string") delete envelope.error;
			return envelope;
		}
		/** The one sentence every unreadable answer turns into. */
		function unreadable(response, cause) {
			const kind = response.headers.get("content-type") ?? "no content-type";
			return `The Ollama settings API answered with ${response.status} and no JSON body (${kind})` + (cause instanceof Error ? `: ${cause.message}` : "") + ". The Host log holds the underlying error.";
		}
		//#endregion
		//#region src/client/ollama/locales.ts
		const NS_OLLAMA = "dsh-ollama";
		const zh$3 = {
			...accountPoolZh,
			relogin: "更换 Key",
			needsRelogin: "Key 已失效",
			addAccount: "添加 API Key",
			noAccounts: "暂无 API Key。点击「添加 API Key」粘贴 ollama.com 创建的 Key。",
			title: "Ollama",
			pageDesc: "接入 Ollama Cloud，用多个 API Key 组成号池，自动轮换与故障转移。",
			routeOwned: "模型路由由本插件提供",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重试。",
			keySection: "添加 API Key",
			keyHint: "在 https://ollama.com/settings/keys 创建 API Key 后粘贴到此处。Key 不会过期，可随时在设置页吊销。",
			keyPlaceholder: "粘贴 Ollama API Key",
			keyAliasLabel: "备注名（可选）",
			keyAliasPlaceholder: "例如：主号、备用号",
			keyAliasHint: "Ollama 不返回账号信息，多个 Key 靠备注名区分。",
			keySave: "添加",
			keySaving: "添加中...",
			modelsSection: "模型",
			modelsHint: "模型列表来自 Ollama 的 /api/tags，随服务更新，无需手动维护。",
			catalogSync: "同步模型列表",
			catalogSyncing: "同步中...",
			catalogNeverSynced: "尚未同步模型列表。点右上角「同步模型列表」获取你账号可用的模型 —— 在此之前这里不会有任何条目，本线路也不会出现在模型选择器中。",
			catalogEmpty: "Ollama 未返回任何模型。",
			catalogNeedKey: "请先添加一个 API Key，再同步模型列表。",
			catalogFailed: "无法从 Ollama 读取模型列表。",
			modelCount: "{count} 个模型",
			noModels: "暂无可用模型。",
			selectAll: "全选",
			unselectAll: "全不选",
			noneSelected: "未选择任何模型，该线路不会出现在模型选择器中。",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考档位",
			defaultReasoningEffortHint: "只对支持思考控制的模型生效。具体可选档位由模型自身决定：gpt-oss 一类只接受 low / medium / high，deepseek-r1 一类只有开或关，其余模型不接受思考控制，Host 会按模型形态收敛。选「不指定」时使用模型自身的默认值。",
			defaultEffortAuto: "不指定",
			limitsSection: "能力边界",
			limitsHint: "以下为 Ollama Cloud 官方文档列出的限制，本线路不会绕过：",
			limitNoStateful: "不支持 Responses 的有状态会话（仅无状态形式）。",
			limitNoWebSearch: "不支持通过 /v1/responses 使用内置联网搜索。",
			limitNoToolReplay: "不支持自定义工具调用的重放（replay）。",
			limitUsage: "Ollama 没有配额/剩余额度 API（上游 issue #15132、#15663 均已关闭），所以只能显示「已消耗」，无法显示「剩余多少」。",
			wireNote: "请求默认走 OpenAI 兼容面（/v1），必要时回落到原生面（/api/chat）。",
			lastModel: "最近模型",
			keyCreated: "添加于",
			error: "操作失败：{detail}",
			usageTitle: "累计消耗",
			usageInput: "输入 {tokens}",
			usageOutput: "输出 {tokens}",
			usageRequests: "{count} 次请求",
			usageNone: "尚无请求",
			usageHint: "按 Ollama 每次响应自带的 token 计数本地累加。"
		};
		const en$3 = {
			...accountPoolEn,
			relogin: "Replace Key",
			needsRelogin: "Key rejected",
			addAccount: "Add API Key",
			noAccounts: "No API keys yet. Click \"Add API Key\" to paste one from ollama.com.",
			title: "Ollama",
			pageDesc: "Connect Ollama Cloud with several API keys pooled for rotation and failover.",
			routeOwned: "Model route served by this plugin",
			routeConflict: "The model route is already owned by another provider: {detail}",
			keySection: "Add an API key",
			keyHint: "Create a key at https://ollama.com/settings/keys and paste it here. Keys do not expire and can be revoked from that page.",
			keyPlaceholder: "Paste an Ollama API key",
			keyAliasLabel: "Label (optional)",
			keyAliasPlaceholder: "e.g. primary, backup",
			keyAliasHint: "Ollama reports no account identity, so labels are what tell several keys apart.",
			keySave: "Add",
			keySaving: "Adding...",
			modelsSection: "Models",
			modelsHint: "The list comes from Ollama '/api/tags' and tracks the service, so there is nothing to maintain by hand.",
			catalogSync: "Sync model list",
			catalogSyncing: "Syncing...",
			catalogNeverSynced: "The model list has not been synced yet. Use \"Sync model list\" above to fetch the models your account can use - until then this list is empty and the line will not appear in the model picker.",
			catalogEmpty: "Ollama returned no models.",
			catalogNeedKey: "Add an API key before syncing the model list.",
			catalogFailed: "Could not read the model list from Ollama.",
			modelCount: "{count} model(s)",
			noModels: "No models available.",
			selectAll: "Select all",
			unselectAll: "Clear all",
			noneSelected: "No models are selected, so this line will not appear in the model picker.",
			enhanced: "Enhanced",
			defaultReasoningEffort: "Default thinking level",
			defaultReasoningEffortHint: "Applies only to models that accept thinking control. The levels a model can take are its own: the gpt-oss family takes low / medium / high, the deepseek-r1 family takes only on or off, and the rest take no thinking control at all — the Host narrows the stored level to what the target model accepts. Choose \"Do not specify\" to leave each model on its own default.",
			defaultEffortAuto: "Do not specify",
			limitsSection: "Documented limits",
			limitsHint: "Ollama Cloud documents these limits; this line does not work around them:",
			limitNoStateful: "No stateful Responses (stateless only).",
			limitNoWebSearch: "No built-in web search through /v1/responses.",
			limitNoToolReplay: "No replay of custom tool calls.",
			limitUsage: "Ollama has no quota or remaining-balance API (upstream issues #15132 and #15663 were both closed), so this card can show what has been consumed but not what is left.",
			wireNote: "Requests use the OpenAI-compatible surface (/v1) and fall back to the native surface (/api/chat) when needed.",
			lastModel: "Last model",
			keyCreated: "Added",
			error: "Action failed: {detail}",
			usageTitle: "Consumed so far",
			usageInput: "in {tokens}",
			usageOutput: "out {tokens}",
			usageRequests: "{count} request(s)",
			usageNone: "No requests yet",
			usageHint: "Summed locally from the token counts Ollama returns on each response."
		};
		const dictionaries$3 = {
			zh: zh$3,
			"zh-CN": zh$3,
			en: en$3,
			"en-US": en$3
		};
		//#endregion
		//#region src/client/ollama/OllamaSection.tsx
		const API = new OllamaApi();
		/**
		* What each thinking level says in this card.
		*
		* 'none' is the only one that needs words, because it is not a weaker rung on
		* the same ladder: it means "send no thinking control", which for the boolean
		* families (deepseek-r1 and friends) is an explicit off, and for gpt-oss means
		* nothing at all. The other three are spelled the way the models spell them.
		*/
		const EFFORT_LABELS = {
			none: "none（关闭思考）",
			low: "low（低）",
			medium: "medium（中）",
			high: "high（高）"
		};
		/**
		* A token count short enough to sit in an account card.
		*
		* Exact below a thousand, then thousands, then millions. A six-figure number with
		* no grouping is unreadable at card width, and these are running totals that only
		* ever grow, so rounding is fine but commas are not optional.
		*/
		function formatTokens(value) {
			if (!Number.isFinite(value) || value < 0) return "—";
			if (value < 1e3) return String(Math.floor(value));
			if (value < 1e6) return `${(value / 1e3).toFixed(value < 1e4 ? 1 : 0)}K`;
			return `${(value / 1e6).toFixed(1)}M`;
		}
		/**
		* The Ollama tab.
		*
		* Deliberately thin. The account card, its badges and the rotation picker are
		* the shared {@link AccountPoolSection}, so this line looks
		* like every other provider tab by construction rather than by imitation; only
		* what is genuinely Ollama's - pasting a key, syncing the catalog, and the
		* documented service limits - is written here.
		*/
		function OllamaSection(props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [key, setKey] = (0, react.useState)("");
			const [alias, setAlias] = (0, react.useState)("");
			const [showKeyForm, setShowKeyForm] = (0, react.useState)(false);
			/** Ids the user has switched on. Null means 'no filter', i.e. all of them. */
			const [enabled, setEnabled] = (0, react.useState)(null);
			const reload = (0, react.useCallback)(async () => {
				try {
					const next = await API.status();
					setStatus(next);
					setEnabled(next.enabledModelIds == null ? null : new Set(next.enabledModelIds));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, []);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const run = (0, react.useCallback)(async (label, action) => {
				setBusy(label);
				setError(null);
				try {
					setStatus(await action());
					props.onModelChange?.();
					props.loadModelDirectory?.();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(null);
				}
			}, [props]);
			const addKey = (0, react.useCallback)(() => {
				const trimmed = key.trim();
				if (trimmed === "") return;
				run("add", async () => {
					const next = await API.accountAction("add", {
						apiKey: trimmed,
						...alias.trim() === "" ? {} : { alias: alias.trim() }
					});
					setKey("");
					setAlias("");
					setShowKeyForm(false);
					return next;
				});
			}, [
				key,
				alias,
				run
			]);
			const syncCatalog = (0, react.useCallback)(() => {
				run("catalog", async () => {
					await API.refreshCatalog();
					return API.status();
				});
			}, [run]);
			const isModelEnabled = (0, react.useCallback)((id) => {
				return enabled === null || enabled.has(id);
			}, [enabled]);
			const applyEnabled = (0, react.useCallback)((next) => {
				run("models", async () => {
					const result = await API.setEnabledModels(next);
					setEnabled(result.enabledModelIds == null ? null : new Set(result.enabledModelIds));
					return API.status();
				});
			}, [run]);
			const toggleModel = (0, react.useCallback)((id, checked) => {
				if (status === null) return;
				const all = status.models ?? [];
				const current = all.filter((model) => isModelEnabled(model.id)).map((model) => model.id);
				const next = checked ? [.../* @__PURE__ */ new Set([...current, id])] : current.filter((entry) => entry !== id);
				applyEnabled(next.length === all.length ? null : next);
			}, [
				status,
				isModelEnabled,
				applyEnabled
			]);
			const setAllModels = (0, react.useCallback)((selectAll) => {
				applyEnabled(selectAll ? null : []);
			}, [applyEnabled]);
			const setEffort = (0, react.useCallback)((value) => {
				run("effort", () => API.setDefaultReasoningEffort(value === "" ? null : value));
			}, [run]);
			const t = zh$3;
			const pool = status?.pool;
			const models = status?.models ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsha-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.title })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-notice",
							children: t.pageDesc
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-notice",
							style: { color: "var(--dsha-danger, #c0392b)" },
							children: t.error.replace("{detail}", error)
						})
					]
				}),
				pool !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPoolSection, {
					accounts: pool.accounts,
					activeAccountId: pool.activeAccountId,
					rotationStrategy: pool.rotationStrategy,
					labels: t,
					busy,
					onLogin: () => setShowKeyForm((value) => !value),
					onSetPrimary: (id) => void run("set-primary", () => API.accountAction("set-primary", { accountId: id })),
					onDelete: (id) => void run("delete", () => API.accountAction("delete", { accountId: id })),
					onClearCooldown: (id) => void run("clear-cooldown", () => API.accountAction("clear-cooldown", { accountId: id })),
					onSetStrategy: (strategy) => void run("strategy", () => API.accountAction("strategy", { strategy })),
					renderDetails: (account) => {
						const usage = account.usage;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [account.lastModelId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.lastModel,
							": ",
							account.lastModelId
						] }), usage === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.usageNone }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							t.usageInput.replace("{tokens}", formatTokens(usage.inputTokens)),
							t.usageOutput.replace("{tokens}", formatTokens(usage.outputTokens)),
							t.usageRequests.replace("{count}", String(usage.requestCount))
						] })] });
					},
					renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							gap: 8
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsha-btn dsha-btn-primary",
							disabled: busy !== null,
							onClick: () => setShowKeyForm((value) => !value),
							children: t.addAccount
						})
					}),
					children: showKeyForm && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-pref-row",
						style: {
							flexDirection: "column",
							alignItems: "stretch",
							gap: 8
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsha-label",
								htmlFor: "ollama-key",
								children: t.keySection
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "ollama-key",
								className: "dsha-input",
								type: "password",
								value: key,
								placeholder: t.keyPlaceholder,
								autoComplete: "off",
								onChange: (event) => setKey(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsha-label",
								htmlFor: "ollama-alias",
								children: t.keyAliasLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "ollama-alias",
								className: "dsha-input",
								value: alias,
								placeholder: t.keyAliasPlaceholder,
								onChange: (event) => setAlias(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								style: { fontSize: 12 },
								children: t.keyHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								style: { fontSize: 12 },
								children: t.keyAliasHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn dsha-btn-primary",
									disabled: busy !== null || key.trim() === "",
									onClick: addKey,
									children: busy === "add" ? t.keySaving : t.keySave
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => setShowKeyForm(false),
									children: zh$3.deleteAccount
								})]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsha-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-grouphead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null,
								onClick: syncCatalog,
								children: busy === "catalog" ? t.catalogSyncing : t.catalogSync
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { fontSize: 12 },
							children: t.modelsHint
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { fontSize: 12 },
							children: t.wireNote
						}),
						status !== null && models.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-empty",
							children: status.catalogSynced ? t.catalogEmpty : t.catalogNeverSynced
						}),
						status !== null && models.length === 0 && !status.usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { fontSize: 12 },
							children: t.catalogNeedKey
						}),
						status !== null && models.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { fontSize: 12 },
							children: t.modelCount.replace("{count}", String(models.length))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
							items: models.map((model) => ({
								id: model.id,
								name: model.name ?? model.id,
								enabled: isModelEnabled(model.id)
							})),
							busy: busy !== null,
							onToggle: (id, enabled) => void toggleModel(id, enabled),
							onToggleAll: (enabled) => void setAllModels(enabled),
							labels: {
								selectAll: t.selectAll,
								clearAll: t.unselectAll,
								list: t.modelsSection
							}
						})] })
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsha-group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-grouphead",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-pref-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							children: t.defaultReasoningEffortHint
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "dsha-select",
							"aria-label": t.defaultReasoningEffort,
							value: status?.defaultReasoningEffort ?? "",
							disabled: busy !== null,
							onChange: (event) => setEffort(event.currentTarget.value),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t.defaultEffortAuto
							}), OLLAMA_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: effort,
								children: EFFORT_LABELS[effort]
							}, effort))]
						})]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsha-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsha-grouphead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.limitsSection })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsha-muted",
							style: { fontSize: 12 },
							children: t.limitsHint
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
							className: "dsha-notice",
							style: { paddingLeft: 18 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t.limitNoStateful }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t.limitNoWebSearch }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t.limitNoToolReplay }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t.limitUsage })
							]
						})
					]
				})
			] });
		}
		//#endregion
		//#region src/client/step-code/locales.ts
		/**
		* Step Code（Step Plan 订阅）线路的客户端命名空间。
		*
		* 与其余每条线路一个命名空间：卡片渲染自己的字典，不复用 hub 挂在
		* 'settings.section' 上的那张座位（那张座绑定的是 ChatGPT 的键集，
		* 键名重合的会被渲染成 ChatGPT 的措辞，不重合的会把键名本身打印出来）。
		*/
		const NS_STEP_CODE = "dsh-step-code";
		const zh$2 = {
			...accountPoolZh,
			title: "Step Code（Step Plan 订阅）",
			pageDesc: "用 StepFun 的 Step Plan 订阅（国区 api.stepfun.com / 国际区 api.stepfun.ai）或开放平台 API Key 接入，管理账号池、套餐额度、缓存用量与模型勾选。区域是凭据的属性，两区凭据互不通用，因此号池里可以同时存在两区账号。",
			loading: "加载中...",
			/** 折叠区的标题：标题下只留一句，其余原句收在这里（折叠不是删除）。 */
			moreNotes: "更多说明",
			profile: "凭据类型",
			profileStepPlan: "国区 Step Plan（订阅，浏览器授权）",
			profileStepPlanOversea: "国际区 Step Plan（订阅，浏览器授权）",
			profilePlatformCn: "国区开放平台（API Key，按量计费）",
			profilePlatformOversea: "国际区开放平台（API Key，按量计费）",
			profileHint: "profile 一次决定三件事：凭据来源、模型 base 域名、开发者中心读取的区域。",
			profileHintExtra: "四个取值与官方逐字相同，因此卡片不给自由输入；区域交叉的凭据会被上游直接拒绝。",
			region: "区域",
			regionCn: "国区（stepfun.com）",
			regionIntl: "国际区（stepfun.ai）",
			regionHint: "区域由凭据里的 profile 唯一决定，本页只显示当前选择属于哪一区，不能单独改。",
			authorizing: "授权中…",
			loginIdle: "尚未开始登录。",
			/** idle 不是一个状态，而是「本进程还没开过流」。号池里已经有账号时它说的是别的事，
			*  所以另起一句，别让「尚未开始登录」与上面明明列着的账号互相打架。 */
			loginHaveAccounts: "号池里已有 {count} 个账号可用。要再加一个就点上面的「添加账号」。",
			loginPending: "请在浏览器里人工确认授权，然后本卡片会自动继续。云端轮询登录不开本地回调端口，流程跑在 host 上。",
			loginComplete: "登录完成，账号已加入号池。",
			loginCompletedAt: "完成时间：{time}",
			loginCompleteNoAccount: "这次登录完成了，但号池里已经没有这个账号（可能已被删除）。",
			loginError: "登录失败。",
			loginRetryable: "这是可重试的失败（传输错误，或 408/429/5xx），可以直接重新发起一次登录。",
			loginNotRetryable: "这次失败不会自己好（协议不合法或用户拒绝），请检查网络与所选凭据类型后重新发起。",
			authorizeUrl: "授权页面",
			openAuthorizeUrl: "打开授权页面",
			pollEvery: "每 {seconds} 秒查询一次登录结果。",
			loginExpiresAt: "本次授权最长可用到 {time}，过期后需要重新发起。",
			progress: "进度",
			restartLogin: "重新发起登录",
			cancelLogin: "取消登录",
			cancelLoginBusy: "取消中…",
			manualPasteSection: "手工粘贴 Platform API Key",
			manualPasteHint: "没有浏览器、或不想走浏览器授权时，把 Step 开放平台的 API Key 粘贴到下面即可登录（对应两个 platform_* 凭据类型，按量计费）。兜底通道常驻只是收起：它与上面的登录是同一件事的两种做法，随时可以点开。",
			manualPastePlaceholder: "粘贴 Platform API Key（sk-…）",
			manualPasteSubmit: "提交 API Key",
			manualPasteSubmitting: "提交中...",
			manualPasteEmpty: "请先粘贴 API Key。",
			adopt: "导入本机 stepcode 登录态",
			adopting: "导入中...",
			adoptAdopted: "已导入本机 stepcode 的登录态（{profile}），无需重新登录。",
			adoptNoAttempt: "本机没有可导入的 stepcode 登录态。",
			adoptNoCredentialsFile: "没有找到 stepcode 的凭据文件（~/.stepcode/auth.json）。装过 stepcode 客户端并登录过一次才会有这个文件。",
			adoptInvalidCredentials: "凭据文件读不出来或已被损坏，导入中止（导入只读，绝不改写 stepcode 的任何文件）。",
			adoptUnsupportedShape: "读懂了文件但认不出它的形状，可能需要升级本插件后再试。",
			adoptNotAStepcodeLogin: "文件在，但里面不是 Step 的登录态（同一份 auth.json 里可能有别的工具的条目）。请改用浏览器登录，或手工粘贴 Platform API Key。",
			adoptFallback: "导入只是省一次登录的快捷路径，失败不影响使用。",
			adoptedBadge: "导入的登录态",
			connection: "连接",
			testConnection: "测试连接",
			testingConnection: "测试中...",
			testSuccess: "连通正常",
			testSuccessAccount: "连通正常（账号 {account}）",
			testSuccessModel: "连通正常（{model}）",
			testFailed: "连接测试失败",
			testFailedDetail: "连接测试失败：{detail}",
			testLatency: "往返 {ms} 毫秒",
			routeOwned: "本插件正在服务该模型路由。",
			routeConflict: "模型路由已被其他 Provider 占用：{detail}。请在 DSH 设置中移除重复的 Provider 配置后重新加载。",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表中；能力不从模型名推断，全部取自运行时发现的上游目录字段。",
			modelsHintExtra: "拿不到证据的字段按兜底值显示而不是猜；目录按凭据所在区域过滤，跨区调用会被上游拒绝。",
			modelsUnavailable: "暂无可显示的模型（目录按需发现，登录后或点「刷新模型目录」再试）。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中...",
			dismiss: "知道了",
			selectAll: "全选",
			unselectAll: "全不选",
			modelChecklistCount: "{count}/{total}",
			enabledModelIdsSemantics: "勾选规则：取消勾选会清空选择，而清空等于不过滤——目录里的模型全部可用（非空才是显式选择）。想真的少用几个模型，就只勾那几个。",
			defaultEffort: "默认思考档位",
			defaultEffortHint: "这是线路级档位表；请求发出前会收敛到目标模型真实支持的档位上，所以列出全表不会给一个只认两档的模型发错档。",
			defaultEffortHintExtra: "收敛逻辑在 host；选「跟随各模型默认」表示各模型用它自己的默认档位。",
			defaultEffortModel: "跟随各模型默认",
			effortMinimal: "最低（minimal）",
			effortLow: "低（low）",
			effortMedium: "中（medium）",
			effortHigh: "高（high）",
			effortXHigh: "很高（xhigh）",
			effortMax: "最高（max）",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认值来自上游目录（每个模型报的 max_input_tokens），可覆盖为 DSH 用于压缩与溢出判断的容量，支持 1M、512K、200K 等写法。",
			contextWindowHintExtra: "端点不报输出上限，因此输出上限默认等于上下文窗口。",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现该模型的上下文窗口设置。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			tokens: "tokens",
			save: "保存",
			saving: "保存中...",
			saved: "已保存",
			invalidCapacity: "容量格式无效：{value}",
			quotaSection: "用量与配额",
			quotaDesc: "数据来自 Step 开发者中心（非公开接口：先用开放平台账号密码换取 Oasis-Token，再用它读 Dashboard）。这是本线路唯一的合规与稳定性风险点，读取失败不影响模型请求。",
			quotaRefresh: "刷新用量",
			quotaRefreshing: "刷新中...",
			quotaSignedOut: "未登录，先在上方完成登录。",
			quotaEmpty: "暂无配额数据，点击「刷新用量」重试。",
			quotaPlan: "套餐",
			quotaPlanFamily: "plan_family",
			quotaRenews: "续费时间",
			quotaReadAt: "读取时间",
			quotaSources: "数据源",
			quotaRegion: "读取区域",
			quotaRefreshingNote: "正在后台刷新配额，下方是上一次读到的数字。",
			quotaErrorLabel: "配额读取失败",
			quotaWindowNames: "窗口名按窗口长度本地化（5 小时 / 1 周 / 1 月），不在本页硬编码；每个账号自己的进度条画在它的账号卡片里。",
			quotaUsed: "已用",
			quotaResets: "重置",
			quotaNoReset: "上游没给重置时间",
			quotaUsedUnknown: "上游没给已用百分比",
			quotaKindWindowed: "老式窗口套餐（5 小时 / 周）",
			quotaKindCredit: "Credit 月池",
			quotaKindUnknown: "认不出的套餐形状",
			quotaKindHint: "上游同时在用两代套餐，判定按载荷形状（老式窗口字段 / credit_buckets）而不是只信 plan_family。认不出来时只显示「认不出」，不画任何进度条。",
			quotaWindowFiveHour: "5 小时窗口",
			quotaWindowWeekly: "周窗口",
			quotaWindowCredit: "Credit 月池",
			quotaBucketTotal: "总额",
			quotaBucketRemaining: "剩余",
			quotaBucketExpires: "失效时间",
			quotaBucketResets: "重置时间",
			quotaCredentialSection: "额度凭据（开发者中心）",
			quotaCredentialSource: "凭据来源",
			quotaCredentialFoot: "额度接口需要 Oasis-Token，这里显示的只是「有没有、从哪来」：凭据本身只存在于 host、永远不下发到前端；账号密码与 Token 也只在你点击提交的那一刻随请求体交给 host——不写入本地存储、不进 URL、不写日志，也没有任何接口能把它们读回来。",
			quotaCredentialNone: "尚未配置额度凭据，额度卡片读不到数据。",
			quotaCredentialAuto: "账号密码自动换取（auto）",
			quotaCredentialManual: "手动粘贴（manual）",
			quotaCredentialAccount: "登录账号",
			quotaCredentialExpires: "过期时间",
			quotaCredentialError: "上次用它读取失败",
			quotaCredentialPasswordSection: "用开放平台账号密码换取 Token",
			quotaCredentialAccountPlaceholder: "Step 开放平台账号（邮箱或手机号）",
			quotaCredentialPasswordPlaceholder: "密码",
			quotaCredentialPasswordSubmit: "换取 Token",
			quotaCredentialPasswordSubmitting: "换取中...",
			quotaCredentialAccountEmpty: "请先填写 Step 开放平台账号。",
			quotaCredentialPasswordEmpty: "请先填写密码。",
			quotaCredentialManualSection: "手动粘贴 Oasis-Token",
			quotaCredentialTokenPlaceholder: "粘贴 Oasis-Token（浏览器开发者工具里复制）",
			quotaCredentialTokenSubmit: "提交 Token",
			quotaCredentialTokenSubmitting: "提交中...",
			quotaCredentialTokenEmpty: "请先粘贴 Oasis-Token。",
			quotaCredentialClear: "清除额度凭据",
			quotaCredentialClearing: "清除中...",
			cacheSection: "缓存用量",
			cacheDesc: "Step 服务端是自动前缀缓存：前缀够了就命中，客户端既没有缓存参数也没有「写入」这个动作。所以这里只有读侧一个维度，写侧恒为 0 并如实标注。",
			cacheStatScope: "以下数字是 DSH 本机对已回报用量的请求做的统计，不是上游账单。",
			cacheFieldOrder: "读侧解析顺序",
			cacheReadTokens: "缓存读入",
			cacheMissedTokens: "未命中输入",
			cacheHitRatio: "缓存命中率",
			cacheRequests: "统计请求数",
			cacheWriteNote: "本线路不报缓存写入",
			cacheWriteNoteValue: "写侧 token",
			cacheWriteNoteHint: "写侧在本线路恒为 0：服务端自动前缀缓存没有「写入」动作，也没有对应的计费项。任何声称这里写过缓存的数字都是编的，因此本页不画写侧进度条。",
			cacheRequestParams: "在请求里发送缓存参数",
			cacheRequestParamsHint: "当前不发缓存参数：Step 服务端是自动前缀缓存，官方对 Step 端点也默认不发。",
			cacheRequestParamsNote: "打开这个能力位会发出未在 Step 文档里说明过的字段（官方客户端把 prompt_cache_key 的发送条件硬绑在 api.openai.com），实测过端点接受度再开。",
			cacheRequestParamsOnHint: "已打开能力位：请求会带上缓存参数。该字段未在 Step 文档中说明，官方对 Step 端点默认也不发。",
			cachePricingNote: "单价未文档化（官方模型表里四个 cost 键全是 0），因此本页只展示 token 维度，不展示任何金额。",
			cacheEmpty: "本进程还没有任何请求回报过用量，跑一次对话后再看。",
			cacheHitRatioUnavailable: "—"
		};
		const en$2 = {
			...accountPoolEn,
			title: "Step Code (Step Plan subscription)",
			pageDesc: "Reach StepFun with a Step Plan subscription (China api.stepfun.com / international api.stepfun.ai) or an open-platform API key, and manage the account pool, plan quota, cache usage and model selection. A region is a property of the credential and the two never share, so a pool can carry accounts from both.",
			loading: "Loading...",
			/** The collapsed block's label: one line stays under the heading, the rest folds in here. */
			moreNotes: "More details",
			profile: "Credential type",
			profileStepPlan: "China Step Plan (subscription, browser sign-in)",
			profileStepPlanOversea: "International Step Plan (subscription, browser sign-in)",
			profilePlatformCn: "China open platform (API key, pay per token)",
			profilePlatformOversea: "International open platform (API key, pay per token)",
			profileHint: "One profile decides three things at once: where the credential comes from, which model base domain is used, and which developer center is read.",
			profileHintExtra: "The four values are the official ones verbatim, so this page offers no free input; a cross-region credential is refused outright upstream.",
			region: "Region",
			regionCn: "China (stepfun.com)",
			regionIntl: "International (stepfun.ai)",
			regionHint: "The region is decided by the profile inside the credential; this page only reports which region the current choice belongs to.",
			authorizing: "Authorizing…",
			loginIdle: "No sign-in started yet.",
			loginHaveAccounts: "The pool already holds {count} account(s), ready to use. To add another, choose “Add Account” above.",
			loginPending: "Confirm the authorization in the browser; this card then continues on its own. The cloud polling sign-in opens no local callback port — the flow runs on the host.",
			loginComplete: "Signed in — the account joined the pool.",
			loginCompletedAt: "Signed in at {time}",
			loginCompleteNoAccount: "That sign-in completed, but the account is no longer in the pool (it may have been deleted).",
			loginError: "Sign-in failed.",
			loginRetryable: "This failure is retryable (a transport error, or 408/429/5xx): start a fresh sign-in.",
			loginNotRetryable: "This failure will not resolve itself (a protocol violation or a user refusal): check the network and the chosen credential type, then start again.",
			authorizeUrl: "Authorization page",
			openAuthorizeUrl: "Open the authorization page",
			pollEvery: "Polling for the result every {seconds}s.",
			loginExpiresAt: "This authorization is valid until {time}; after that a new one must be started.",
			progress: "Progress",
			restartLogin: "Start again",
			cancelLogin: "Cancel sign-in",
			cancelLoginBusy: "Cancelling…",
			manualPasteSection: "Paste a Platform API key",
			manualPasteHint: "Without a browser, or simply to skip it, paste a Step open-platform API key below (these are the two platform_* credential types, billed per token). The fallback stays in the page but collapsed: it is the other way of doing the same thing, and opens on demand.",
			manualPastePlaceholder: "Paste the Platform API key (sk-…)",
			manualPasteSubmit: "Submit the key",
			manualPasteSubmitting: "Submitting…",
			manualPasteEmpty: "Paste an API key first.",
			adopt: "Import the local stepcode sign-in",
			adopting: "Importing...",
			adoptAdopted: "Imported the local stepcode sign-in ({profile}); no sign-in needed.",
			adoptNoAttempt: "There is no local stepcode sign-in to import.",
			adoptNoCredentialsFile: "No stepcode credentials file found (~/.stepcode/auth.json). It exists once the stepcode client has been installed and signed into.",
			adoptInvalidCredentials: "The credentials file could not be read or looks damaged, so the import stopped. Importing is read-only: it never rewrites any stepcode file.",
			adoptUnsupportedShape: "The file was read but its shape is not recognized; upgrading this plugin may be needed.",
			adoptNotAStepcodeLogin: "The file exists but holds no Step sign-in (the same auth.json may carry entries for another tool). Use the browser sign-in above, or paste a key instead.",
			adoptFallback: "Importing only saves you one sign-in; a failure never blocks the line.",
			adoptedBadge: "Imported sign-in",
			connection: "Connection",
			testConnection: "Test connection",
			testingConnection: "Testing...",
			testSuccess: "Connection OK",
			testSuccessAccount: "Connection OK (account {account})",
			testSuccessModel: "Connection OK ({model})",
			testFailed: "Connection test failed",
			testFailedDetail: "Connection test failed: {detail}",
			testLatency: "{ms} ms round trip",
			routeOwned: "This plugin serves the model route.",
			routeConflict: "Another provider already owns the model route: {detail}. Remove the duplicate provider configuration in DSH settings and reload.",
			modelsSection: "Models",
			modelsHint: "Only checked models appear in the conversation model picker. Capabilities are never inferred from a model name: every field comes from the runtime-discovered upstream catalog.",
			modelsHintExtra: "A field with no evidence falls back to its declared default rather than being guessed; the catalog is filtered by the region of the credential, and the upstream rejects a model asked of the wrong region.",
			modelsUnavailable: "No model to show yet (the catalog is discovered on demand — sign in, or use “Refresh catalog”).",
			refreshCatalog: "Refresh catalog",
			refreshingCatalog: "Refreshing...",
			dismiss: "Dismiss",
			selectAll: "Select all",
			unselectAll: "Deselect all",
			modelChecklistCount: "{count}/{total}",
			enabledModelIdsSemantics: "How selection works: clearing every row empties the list, and an empty list means no filter — every catalog model stays available (only a non-empty list is an explicit selection). To genuinely use fewer models, check just those.",
			defaultEffort: "Default thinking level",
			defaultEffortHint: "This is the line-level vocabulary; a request is converged onto the ladder the target model really accepts before it is sent, so listing the full table cannot send an unsupported level.",
			defaultEffortHintExtra: "The convergence lives on the host; choosing “each model its own default” leaves every model where it is.",
			defaultEffortModel: "Each model its own default",
			effortMinimal: "Minimal",
			effortLow: "Low",
			effortMedium: "Medium",
			effortHigh: "High",
			effortXHigh: "Very high",
			effortMax: "Max",
			contextWindowSection: "Model context windows",
			contextWindowHint: "Defaults come from the upstream catalog (the max_input_tokens each model reports). Override one with the capacity DSH uses for compaction and overflow decisions; 1M, 512K, 200K and similar are accepted.",
			contextWindowHintExtra: "The endpoint reports no output cap, so the output cap defaults to the context window.",
			contextWindowNoneEnabled: "No model is checked yet. Check one above and its context window setting appears here.",
			contextWindowReset: "Restore default",
			contextWindowResetAll: "Restore all defaults",
			tokens: "tokens",
			save: "Save",
			saving: "Saving...",
			saved: "Saved",
			invalidCapacity: "Invalid capacity: {value}",
			quotaSection: "Usage & quota",
			quotaDesc: "Read from the Step developer center — an UNDOCUMENTED endpoint: sign in with the open-platform account and password to obtain an Oasis-Token, then read the Dashboard with it. This is the line’s only compliance/stability risk, and a failed read never affects model requests.",
			quotaRefresh: "Refresh usage",
			quotaRefreshing: "Refreshing...",
			quotaSignedOut: "Not signed in — finish the sign-in above first.",
			quotaEmpty: "No quota data yet — use “Refresh usage” to retry.",
			quotaPlan: "Plan",
			quotaPlanFamily: "plan_family",
			quotaRenews: "Renews",
			quotaReadAt: "Read at",
			quotaSources: "Sources",
			quotaRegion: "Read in region",
			quotaRefreshingNote: "Quota is refreshing in the background; the figures below are the last read.",
			quotaErrorLabel: "Quota read failed",
			quotaWindowNames: "Window names are localized from the window length (5 hours / 1 week / 1 month) rather than hardcoded here; each account’s own progress is drawn on its account card.",
			quotaUsed: "used",
			quotaResets: "Resets",
			quotaNoReset: "the upstream gave no reset time",
			quotaUsedUnknown: "the upstream gave no used percentage",
			quotaKindWindowed: "Legacy window plan (5 hours / week)",
			quotaKindCredit: "Credit pool",
			quotaKindUnknown: "Unrecognized plan shape",
			quotaKindHint: "The upstream uses two plan generations at once, and the generation is decided by the PAYLOAD SHAPE (legacy window fields / credit_buckets) rather than by plan_family alone. When neither is recognized the card says so and draws no progress bar at all.",
			quotaWindowFiveHour: "5-hour window",
			quotaWindowWeekly: "Weekly window",
			quotaWindowCredit: "Credit pool",
			quotaBucketTotal: "Total",
			quotaBucketRemaining: "Remaining",
			quotaBucketExpires: "Expires",
			quotaBucketResets: "Resets",
			quotaCredentialSection: "Quota credential (developer center)",
			quotaCredentialSource: "Source",
			quotaCredentialFoot: "The quota endpoint needs an Oasis-Token, and what is shown here is only whether one exists and where it came from — the credential itself stays on the host and is never sent to the front end. The password and the token reach the host only in the request body of the submit you click: they are never written to local storage, never placed in a URL, never logged, and no endpoint can read them back.",
			quotaCredentialNone: "No quota credential yet, so the quota card cannot read anything.",
			quotaCredentialAuto: "Exchanged from account + password (auto)",
			quotaCredentialManual: "Pasted by hand (manual)",
			quotaCredentialAccount: "Signed-in account",
			quotaCredentialExpires: "Expires",
			quotaCredentialError: "The last read with it failed",
			quotaCredentialPasswordSection: "Exchange an account + password for a token",
			quotaCredentialAccountPlaceholder: "Step open-platform account (email or phone)",
			quotaCredentialPasswordPlaceholder: "Password",
			quotaCredentialPasswordSubmit: "Exchange for a token",
			quotaCredentialPasswordSubmitting: "Exchanging…",
			quotaCredentialAccountEmpty: "Fill in the Step open-platform account first.",
			quotaCredentialPasswordEmpty: "Fill in the password first.",
			quotaCredentialManualSection: "Paste an Oasis-Token",
			quotaCredentialTokenPlaceholder: "Paste the Oasis-Token (copy it from the browser devtools)",
			quotaCredentialTokenSubmit: "Submit the token",
			quotaCredentialTokenSubmitting: "Submitting…",
			quotaCredentialTokenEmpty: "Paste an Oasis-Token first.",
			quotaCredentialClear: "Clear the quota credential",
			quotaCredentialClearing: "Clearing…",
			cacheSection: "Cache usage",
			cacheDesc: "The Step service runs an AUTOMATIC prefix cache: a long enough prefix hits, and the client has neither cache parameters nor a “write” action. So only the read side is a real dimension here; the write side is always 0 and is labelled as such.",
			cacheStatScope: "These figures are the local tally DSH keeps over the requests that reported usage on this machine — not an upstream bill.",
			cacheFieldOrder: "Read-side field order",
			cacheReadTokens: "Read from cache",
			cacheMissedTokens: "Missed input",
			cacheHitRatio: "Cache hit ratio",
			cacheRequests: "Requests counted",
			cacheWriteNote: "This route reports no cache writes",
			cacheWriteNoteValue: "Write tokens",
			cacheWriteNoteHint: "The write side is always 0 on this route: an automatic prefix cache has no write action and no matching billing item. Any number claiming this route wrote cache would be invented, so no write-side bar is drawn.",
			cacheRequestParams: "Send cache parameters in requests",
			cacheRequestParamsHint: "No cache parameters are sent: the Step service uses an automatic prefix cache, and the official client does not send them to Step either.",
			cacheRequestParamsNote: "Turning this on sends fields Step does not document (the official client hard-binds the prompt_cache_key condition to api.openai.com); enable it only after measuring whether the endpoint accepts them.",
			cacheRequestParamsOnHint: "The capability is on: requests carry cache parameters. Step does not document them, and the official client does not send them to Step either.",
			cachePricingNote: "Unit prices are undocumented (all four cost keys are 0 in the official model table), so this page shows TOKENS ONLY and no money figure at all.",
			cacheEmpty: "No request on this machine has reported usage yet — run a conversation and look again.",
			cacheHitRatioUnavailable: "—"
		};
		const dictionaries$2 = {
			zh: zh$2,
			"zh-CN": zh$2,
			en: en$2,
			"en-US": en$2
		};
		/** 一个额度窗口的键到「窗口长度（分钟）」的映射。窗口名由共享组件按长度本地化。 */
		const QUOTA_WINDOW_MINUTES = {
			"five-hour": 300,
			weekly: 10080,
			credit: 43200
		};
		/** reason → 字典键。一个 reason 一种文案，因此这里是封闭映射而不是兜底串。 */
		const ADOPT_REASON_KEYS = {
			"no-credentials-file": "adoptNoCredentialsFile",
			"invalid-credentials": "adoptInvalidCredentials",
			"unsupported-shape": "adoptUnsupportedShape",
			"not-a-stepcode-login": "adoptNotAStepcodeLogin"
		};
		function adoptReasonText(reason, dictionary) {
			return dictionary[ADOPT_REASON_KEYS[reason]];
		}
		/** profile → 字典键。四个取值各有各的一句话，因为它们的凭据来源与计费方式都不同。 */
		const PROFILE_KEYS = {
			step_plan: "profileStepPlan",
			step_plan_oversea: "profileStepPlanOversea",
			platform_cn: "profilePlatformCn",
			platform_oversea: "profilePlatformOversea"
		};
		function profileText(profile, dictionary) {
			return dictionary[PROFILE_KEYS[profile]];
		}
		/** 额度窗口键 → 字典键。契约是封闭联合，所以这里也就没有兜底串：认不出的窗口不下发。 */
		const QUOTA_WINDOW_KEYS = {
			"five-hour": "quotaWindowFiveHour",
			weekly: "quotaWindowWeekly",
			credit: "quotaWindowCredit"
		};
		function quotaWindowKeyText(key, dictionary) {
			return dictionary[QUOTA_WINDOW_KEYS[key]];
		}
		const QUOTA_KIND_KEYS = {
			windowed: "quotaKindWindowed",
			credit: "quotaKindCredit",
			unknown: "quotaKindUnknown"
		};
		function quotaKindText(kind, dictionary) {
			return dictionary[QUOTA_KIND_KEYS[kind]];
		}
		const QUOTA_CREDENTIAL_SOURCE_KEYS = {
			auto: "quotaCredentialAuto",
			manual: "quotaCredentialManual"
		};
		/**
		* 额度凭据来源的本地化文案。
		*
		* null（没有凭据）与 undefined（旧 host 没下发这个字段）都回落到「手动粘贴」这一支：
		* 卡片只在确实有凭据的那一行调用它，而「没有」另有 quotaCredentialNone 一句话，
		* 所以这里回落到哪一支都不会被读成「这是手动粘贴来的」。
		*/
		function quotaCredentialSourceText(source, dictionary) {
			return dictionary[QUOTA_CREDENTIAL_SOURCE_KEYS[source ?? "manual"]];
		}
		//#endregion
		//#region src/client/wb/step-code/api.ts
		/**
		* 本线路的 host 路由由这一个文件描述，卡片与输入框胶囊都从这里取。
		*
		* **路由表是与 host 侧 routes.ts 的约定**：下表按计划 §6.1 与兄弟线路的命名习惯定下，
		* 一旦 host 侧拼写不同，只需要改这一个文件。
		*
		*   GET  /status                 → StepCodeStatusDto（页面的唯一读口）
		*   POST /settings               StepCodeSettingsUpdateDto → StepCodeStatusDto
		*                                 （总开关、模型勾选、上下文窗口覆盖、默认档位、手选账号、缓存参数能力位）
		*   POST /accounts               { action, accountId } / { action:'strategy', strategy } → StepCodeStatusDto
		*   POST /login/start            { profile } → StepCodeLoginFlowStatus
		*   GET  /login/status           → StepCodeLoginFlowStatus（云端轮询登录不开本地回调端口，卡片只跟随 host）
		*   POST /login/cancel           { } → StepCodeLoginFlowStatus
		*   POST /login/manual           { profile, apiKey } → StepCodeStatusDto（手工粘贴 Platform API Key；
		*                                 请求体必然带凭据，刻意不在冻结契约里声明）
		*   POST /adopt                  { } → StepCodeAdoptResultDto（**裸 DTO，不走信封**；失败永不阻断，
		*                                 卡片据 reason 给出不同的下一步）
		*   POST /connection/test        → StepCodeConnectionDto（**裸 DTO，不走信封**）
		*   POST /quota                  { } → StepCodeStatusDto（强制刷新额度）
		*   POST /catalog/refresh        { } → StepCodeStatusDto
		*   POST /quota/credential       { mode:'password'|'manual'|'clear', account?, password?, token? }
		*                                 → StepCodeStatusDto（**非公开的开发者中心接口**；凭据只在提交时的
		*                                 请求体里过一趟，永远不回读）
		*
		* 除 /adopt 与 /connection/test 外全部走共享的 { ok, value } 信封，
		* 因此答案都是裸 DTO——createLineApi 已经把信封拆掉了。
		*
		* 凭据边界的另一半也写在这里：/login/manual 与 /quota/credential 的请求体是本文件里
		* **仅有的两处**带秘密的形状，它们只在这两个函数调用点的字面量里出现，
		* 既不进 URL、也不进日志，卡片那边同样没有别的地方可以读到它们。
		*/
		const api$6 = createLineApi(STEP_CODE_ROUTE_PREFIX, STEP_CODE_PROVIDER_NAME);
		const get = api$6.get;
		const post = api$6.post;
		function messageOf(cause) {
			return cause instanceof Error ? cause.message : String(cause);
		}
		//#endregion
		//#region src/client/step-code/useStepCodeSection.ts
		/**
		* Step Code（Step Plan 订阅）设置卡片的状态、副作用与动作。
		*
		* 与 GLM / WorkBuddy / MiniMax Code 同样的分工：这个文件是行为，StepCodeSection.tsx
		* 是渲染，两者之间只通过下面这一个具名结构交接，卡片因此保持「只画」的状态。
		*
		* 一条设计约束贯穿全文件：**能力与文案都不在本文件重算**。模型行的一句话描述来自
		* 契约里的 StepCodeModelOption.hint（host 由运行时发现的目录生成），图片输入与思考
		* 档位来自同一条记录的字段，客户端一旦自己推断能力，就等于把「能力不得从模型名推断」
		* 这条规则重新打开。
		*
		* 凭据边界：密码与 Oasis-Token 只存在于下面三个 setQuota* / submit* 的**局部变量与
		* 受控输入框**里，提交时随 POST 体一次性交给 host，随即被清空。它们不进 URL、不写日志、
		* 没有任何持久化写入，也没有任何读取它们的动作。
		*/
		/** 登录状态机的轮询节奏。真实超时与间隔由 host 拥有，卡片只是跟随。 */
		const LOGIN_POLL_INTERVAL_MS = 2e3;
		/** 本卡片的字典；身份稳定，依赖它的 effect 才不会每次渲染重建。 */
		const fallbackTranslate$1 = (key) => zh$2[key];
		/**
		* 共享账号池卡片需要的标签集，按本卡片的字典逐键查出来。
		*
		* 从共享标签对象自身的键推导，因此共享卡片新增一个标签而这里漏掉时是编译错误，
		* 而不是页面上少一句话。
		*/
		function accountPoolLabelsFor(t) {
			return {
				accountPool: t("accountPool"),
				addAccount: t("addAccount"),
				accountCount: t("accountCount"),
				primaryAccount: t("primaryAccount"),
				activeAccount: t("activeAccount"),
				setPrimary: t("setPrimary"),
				deleteAccount: t("deleteAccount"),
				cooling: t("cooling"),
				cooldownLeft: t("cooldownLeft"),
				clearCooldown: t("clearCooldown"),
				needsRelogin: t("needsRelogin"),
				relogin: t("relogin"),
				rotationStrategy: t("rotationStrategy"),
				strategySequential: t("strategySequential"),
				strategyRoundRobin: t("strategyRoundRobin"),
				strategySticky: t("strategySticky"),
				noAccounts: t("noAccounts"),
				email: t("email"),
				expires: t("expires"),
				lastUsed: t("lastUsed"),
				accountId: t("accountId"),
				accountQuota: t("accountQuota"),
				quotaNone: t("quotaNone"),
				quotaSnapshot: t("quotaSnapshot"),
				quotaResets: t("quotaResets"),
				quotaExhausted: t("quotaExhausted"),
				quotaWindow: t("quotaWindow"),
				quotaUsed: t("quotaUsed"),
				quotaFactsScope: t("quotaFactsScope"),
				composerLabel: t("composerLabel")
			};
		}
		/**
		* host 下发的号池行 → 契约里带 profile 与区域的那一行。
		*
		* 冻结契约写的是 `accounts?: PoolAccountSummaryDto[]`（StepCodeStatusDto 继承的是
		* Partial<AccountPoolStatusDto>），元素类型是最小的 PoolAccountSummaryDto，
		* StepCodeAccountSummaryDto 是它的**扩展**而不是它的元素类型；契约已冻结，所以这里在
		* 客户端补齐：profile / region 等 host 确实下发的字段原样取，只有缺失时才回落到当前
		* 选择的 profile 与它唯一决定的区域。
		*/
		function stepCodeAccounts(status, fallbackProfile) {
			return (status?.accounts ?? []).map((account) => {
				const extra = account;
				const profile = isStepCodeProfile(extra.profile) ? extra.profile : fallbackProfile;
				return {
					...account,
					profile,
					region: extra.region === "cn" || extra.region === "intl" ? extra.region : stepCodeRegionOf(profile),
					...extra.accountName === void 0 ? {} : { accountName: extra.accountName }
				};
			});
		}
		/** status 上可能承载缓存统计的两个键名（先到先用）。 */
		const CACHE_STATS_KEYS = ["cacheStats", "cache"];
		/** 一个有限数字，或 null。host 可能下发字符串或 null，所以逐个校验而不是直接断言。 */
		function finiteNumber(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : null;
		}
		/**
		* 一份候选对象里「缓存读入」与「未命中输入」两个数，或 null。
		*
		* 三种命名都收，因为它们指的是同一对量：host 侧 cache-stats 的聚合用
		* cacheReadTokens + inputTokens（inputTokens 在那条线路上就是 uncached prompt
		* tokens），兄弟线路 Kimi 用 cachedTokens / freshTokens，而本文件对外叫
		* cacheReadTokens / missedInputTokens。折成同一对并不引入任何新的解释——
		* 命中率的算法仍是下面那一个公式，读侧的字段优先级则由
		* STEP_CODE_CACHE_READ_FIELD_ORDER 在 host 侧决定。
		*/
		function cacheTokenPair(value) {
			if (value === null || typeof value !== "object") return null;
			const candidate = value;
			const read = finiteNumber(candidate.cacheReadTokens) ?? finiteNumber(candidate.cachedTokens);
			const missed = finiteNumber(candidate.missedInputTokens) ?? finiteNumber(candidate.freshTokens) ?? finiteNumber(candidate.inputTokens);
			return read === null || missed === null ? null : {
				read,
				missed
			};
		}
		/**
		* 从一份 status 里取缓存统计；取不到返回 null。
		*
		* 返回 null 而不是零值对象，是因为「上游没报」与「报了个 0」在卡片上必须长得不一样：
		* 前者显示占位符，后者显示真实的 0%。
		*/
		function readCacheStats(status) {
			if (status === null) return null;
			const carrier = status;
			for (const key of CACHE_STATS_KEYS) {
				const candidate = carrier[key];
				const pair = cacheTokenPair(candidate);
				if (pair !== null) {
					const fields = candidate;
					return {
						cacheReadTokens: pair.read,
						missedInputTokens: pair.missed,
						cacheWriteTokens: finiteNumber(fields.cacheWriteTokens) ?? 0,
						requests: finiteNumber(fields.requests) ?? finiteNumber(fields.requestCount)
					};
				}
			}
			return null;
		}
		/**
		* 缓存命中率 = 缓存读入 /（缓存读入 + 未命中输入）。
		*
		* 分母为 0（还没有任何请求，或上游只报了输出 token）时返回 **null**，卡片据此画占位符：
		* 把「没有样本」写成 0% 是谎报——它说的是「一个都没命中」，而事实是「还不知道」。
		*/
		function cacheHitRatio(stats) {
			if (stats === null) return null;
			const denominator = stats.cacheReadTokens + stats.missedInputTokens;
			if (!Number.isFinite(denominator) || denominator <= 0) return null;
			return stats.cacheReadTokens / denominator;
		}
		/** 写侧的线路常量；卡片用它渲染说明，而不是渲染一条永远为 0 的进度条。 */
		const CACHE_WRITE_NOTE = STEP_CODE_CACHE_WRITE_NOTE;
		function useStepCodeSection({ onModelChange } = {}) {
			const t = fallbackTranslate$1;
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [connection, setConnection] = (0, react.useState)(null);
			const [adoptResult, setAdoptResult] = (0, react.useState)(null);
			const [pasteValue, setPasteValue] = (0, react.useState)("");
			const [pasteOpen, setPasteOpen] = (0, react.useState)(false);
			const [profile, setProfileState] = (0, react.useState)("step_plan");
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const [quotaAccount, setQuotaAccount] = (0, react.useState)("");
			const [quotaPassword, setQuotaPassword] = (0, react.useState)("");
			const [quotaToken, setQuotaToken] = (0, react.useState)("");
			const profileTouched = (0, react.useRef)(false);
			const quotaFollowUp = (0, react.useRef)(void 0);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					const next = await get("/status");
					setStatus(next);
					setContextDrafts(contextDraftsFor(next));
					if (!profileTouched.current && isStepCodeProfile(next.profile)) setProfileState(next.profile);
					quotaFollowUp.current ??= createQuotaFollowUp();
					quotaFollowUp.current.observe(next.quotaRefreshing === true, () => {
						loadStatus(true);
					});
				} catch (cause) {
					if (!quiet) setError(messageOf(cause));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadStatus();
				const refreshWhenVisible = () => {
					if (document.visibilityState === "visible") loadStatus(true);
				};
				document.addEventListener("visibilitychange", refreshWhenVisible);
				const timer = window.setInterval(refreshWhenVisible, 6e4);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", refreshWhenVisible);
					quotaFollowUp.current?.cancel();
				};
			}, [loadStatus]);
			const loginStatus = status?.login?.status;
			(0, react.useEffect)(() => {
				if (loginStatus !== "pending") return;
				let stopped = false;
				const timer = window.setInterval(() => {
					(async () => {
						try {
							const poll = await get("/login/status");
							if (stopped) return;
							if (poll.status === "complete") {
								setPasteValue("");
								await loadStatus();
								onModelChange?.();
							} else if (poll.status === "error") setError(poll.error ?? t("loginError"));
						} catch {}
					})();
				}, LOGIN_POLL_INTERVAL_MS);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [
				loginStatus,
				loadStatus,
				onModelChange,
				t
			]);
			(0, react.useEffect)(() => {
				setPasteOpen(loginStatus === "pending" || loginStatus === "error");
			}, [loginStatus]);
			const setProfile = (0, react.useCallback)((next) => {
				profileTouched.current = true;
				setProfileState(next);
			}, []);
			const login = async (loginProfile) => {
				try {
					setBusy(`login:${loginProfile}`);
					setError(null);
					setConnection(null);
					setPasteValue("");
					const flow = await post("/login/start", { profile: loginProfile });
					await loadStatus(true);
					if (flow.authorizeUrl !== void 0 && flow.authorizeUrl !== "") try {
						window.open(flow.authorizeUrl, "_blank", "noopener,noreferrer");
					} catch {}
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const cancelLogin = async () => {
				try {
					setBusy("login:cancel");
					setError(null);
					await post("/login/cancel", {});
					await loadStatus(true);
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const submitPaste = async () => {
				const apiKey = pasteValue.trim();
				if (apiKey === "") {
					setError(t("manualPasteEmpty"));
					return;
				}
				try {
					setBusy("login-manual");
					setError(null);
					setStatus(await post("/login/manual", {
						profile,
						apiKey
					}));
					setPasteValue("");
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setPasteValue("");
					setBusy(null);
				}
			};
			const adopt = async () => {
				try {
					setBusy("adopt");
					setError(null);
					const result = await post("/adopt", {});
					setAdoptResult(result);
					await loadStatus(true);
					if (result.adopted) onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const accountAction = async (action, accountId) => {
				try {
					setBusy(`account:${action}:${accountId}`);
					setError(null);
					setStatus(await post("/accounts", {
						action,
						accountId
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const setStrategy = async (strategy) => {
				try {
					setBusy("strategy");
					setError(null);
					setStatus(await post("/accounts", {
						action: "strategy",
						strategy
					}));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			/**
			* 一个模型勾选补丁；host 回整份新状态，卡片因此不必猜哪些 id 最终生效。
			*
			* 语义照计划 §12.1：**缺省或空数组 = 不过滤（全部可用），非空 = 显式选择**。
			* 所以「全不选」提交的是空数组，它的含义是**清除显式选择、回到不过滤**，而不是
			* 「一个模型都不可用」；卡片在按钮旁边也照这句话说明，避免用户按了之后以为坏了。
			*/
			const applyEnabledModels = async (enabledModelIds) => {
				try {
					setError(null);
					const updated = await post("/settings", { enabledModelIds });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				}
			};
			const toggleModel = (modelId, enabled) => {
				if (status === null) return;
				const current = status.models.filter((model) => model.enabled).map((model) => model.id);
				const next = enabled ? [.../* @__PURE__ */ new Set([...current, modelId])] : current.filter((id) => id !== modelId);
				applyEnabledModels(next);
			};
			const setAllModels = (enabled) => {
				if (status === null || status.models.length === 0) return;
				applyEnabledModels(enabled ? status.models.map((model) => model.id) : []);
			};
			const saveContextWindow = async (modelId) => {
				const raw = contextDrafts[modelId] ?? "";
				const parsed = parsePositiveCapacity(raw);
				if (parsed === null) {
					setError(t("invalidCapacity").replace("{value}", raw));
					return;
				}
				try {
					setSavingModel(modelId);
					setError(null);
					setStatus(await post("/settings", { contextWindowOverrides: { [modelId]: parsed } }));
					setContextDrafts((previous) => ({
						...previous,
						[modelId]: formatCapacity(parsed)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetContextWindow = async (modelId) => {
				try {
					setSavingModel(modelId);
					setError(null);
					const updated = await post("/settings", { contextWindowOverrides: { [modelId]: null } });
					setStatus(updated);
					const model = updated.models.find((entry) => entry.id === modelId);
					if (model !== void 0) setContextDrafts((previous) => ({
						...previous,
						[modelId]: formatCapacity(model.defaultContextWindow)
					}));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setSavingModel(null);
				}
			};
			const resetAllContextWindows = async () => {
				const ids = Object.keys(status?.contextWindowOverrides ?? {});
				if (ids.length === 0) return;
				try {
					setError(null);
					const updated = await post("/settings", { contextWindowOverrides: Object.fromEntries(ids.map((id) => [id, null])) });
					setStatus(updated);
					setContextDrafts(contextDraftsFor(updated));
					onModelChange?.();
				} catch (cause) {
					setError(messageOf(cause));
				}
			};
			const setDefaultReasoningEffort = async (effort) => {
				try {
					setBusy("effort");
					setError(null);
					setStatus(await post("/settings", { defaultReasoningEffort: effort }));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const setCacheRequestParams = async (enabled) => {
				try {
					setBusy("cache-params");
					setError(null);
					setStatus(await post("/settings", { cacheRequestParams: enabled }));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const refreshQuota = async () => {
				try {
					setBusy("quota");
					setError(null);
					setStatus(await post("/quota", {}));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const refreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					setStatus(await post("/catalog/refresh", {}));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			const testConnection = async () => {
				try {
					setBusy("connection");
					setError(null);
					setConnection(await post("/connection/test", {}));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(null);
				}
			};
			/**
			* 额度凭据的三种提交。
			*
			* 三者共用一个出口，好处是「凭据只在请求体里过一趟」这件事只写一遍：mode 决定 host
			* 走哪条路，而 password / token 都由这个函数的局部变量直接进 body，函数返回后 React
			* state 里也已经清空（setState 在 finally 里先跑）。**没有任何一处把它们写进
			* localStorage、URL 或日志**，也没有任何接口能把它们读回来。
			*/
			const submitQuotaCredential = async (mode) => {
				const password = quotaPassword;
				const token = quotaToken;
				const account = quotaAccount.trim();
				if (mode === "password" && account === "") {
					setError(t("quotaCredentialAccountEmpty"));
					return;
				}
				if (mode === "password" && password === "") {
					setError(t("quotaCredentialPasswordEmpty"));
					return;
				}
				if (mode === "manual" && token === "") {
					setError(t("quotaCredentialTokenEmpty"));
					return;
				}
				try {
					setBusy(`quota-credential:${mode}`);
					setError(null);
					setStatus(await post("/quota/credential", mode === "password" ? {
						mode,
						account,
						password
					} : mode === "manual" ? {
						mode,
						token
					} : { mode }));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setQuotaPassword("");
					setQuotaToken("");
					setBusy(null);
				}
			};
			const accounts = stepCodeAccounts(status, profile);
			const models = status?.models ?? [];
			const contextModels = models.filter((model) => model.enabled);
			const cache = readCacheStats(status);
			return {
				state: {
					status,
					loading,
					busy,
					error,
					connection,
					adoptResult,
					pasteValue,
					profile,
					pasteOpen,
					contextDrafts,
					savingModel,
					quotaAccount,
					quotaPassword,
					quotaToken
				},
				derived: {
					accounts,
					models,
					contextModels,
					overrideCount: Object.keys(status?.contextWindowOverrides ?? {}).length,
					login: status?.login ?? null,
					quota: status?.quota ?? null,
					authenticated: status?.authenticated === true,
					poolLabels: accountPoolLabelsFor(t),
					cache,
					cacheHitRatio: cacheHitRatio(cache),
					quotaCredential: status?.quotaCredential ?? null
				},
				actions: {
					setProfile,
					login,
					cancelLogin,
					submitPaste,
					setPasteValue,
					togglePaste: () => setPasteOpen((previous) => !previous),
					adopt,
					clearAdoptResult: () => setAdoptResult(null),
					accountAction,
					setStrategy,
					toggleModel,
					setAllModels,
					saveContextWindow,
					resetContextWindow,
					resetAllContextWindows,
					updateContextDraft: (modelId, draft) => {
						setContextDrafts((previous) => ({
							...previous,
							[modelId]: draft
						}));
					},
					setDefaultReasoningEffort,
					setCacheRequestParams,
					refreshQuota,
					refreshCatalog,
					testConnection,
					setQuotaAccount,
					setQuotaPassword,
					setQuotaToken,
					submitQuotaPassword: () => submitQuotaCredential("password"),
					submitQuotaToken: () => submitQuotaCredential("manual"),
					clearQuotaCredential: () => submitQuotaCredential("clear")
				}
			};
		}
		//#endregion
		//#region src/client/step-code/StepCodeSection.tsx
		/**
		* Step Code（Step Plan 订阅）设置卡片。
		*
		* 纯渲染：状态、副作用与请求都在 'useStepCodeSection.ts'，两者之间只通过一个具名结构
		* 交接（GLM / WorkBuddy / MiniMax Code 同款分工）。
		*
		* 本文件没有新建任何 UI 组件：进入入口（hub 卡片）在 hub/providers.tsx，账号池与它的
		* 配额条在 AccountPoolSection，模型勾选在 ModelChecklist，上下文窗口在
		* ContextWindowEditor，输入框胶囊在 StepCodeComposerQuota.tsx。
		*
		* 两条它自己负责的渲染规则：
		*
		*   1. **能力只画契约里的字段**：图片输入、思考档位、上下文窗口全部来自 host 生成的
		*      hint，客户端不按模型名推断任何一项；同一事实只呈现一次——勾选列表的行已经带了
		*      那句话，所以下面不再另起一块把已勾选模型的能力重列一遍；
		*   2. **缓存只画 token 维度**：读入量与命中率一条条，没数据就是占位符；写侧在本线路
		*      恒为 0，用 STEP_CODE_CACHE_WRITE_NOTE 标注而不是画一条永远是 0 的进度条；
		*      单价未文档化，因此整页不出现任何金额。
		*
		* 版面纪律（全卡适用）：**每个分组标题下最多留一行说明**，其余原句收进 .dshsc-details
		* 折叠区（moreNotes 辅助函数），阅读顺序因此固定为「标题 → 一句话 → 控件 → 折叠的补充
		* 说明」。实现坐标（读侧字段优先级链、端点路径、plan_family 的机器值）不留在正文：
		* 它们解释的是这份数据怎么来的，而不是用户现在该做什么——但也绝不删除，一律进折叠区。
		*/
		/** 区域的人类可读名。区域由凭据里的 profile 唯一决定，所以这里只是把 profile 说清楚。 */
		function regionLabel(profile, t) {
			return stepCodeRegionOf(profile) === "cn" ? t.regionCn : t.regionIntl;
		}
		/** 百分比，最多一位小数；调用方已经排除了非有限值。 */
		function percentText(ratio) {
			const value = Math.max(0, Math.min(1, ratio));
			try {
				return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value * 100)}%`;
			} catch {
				return `${Math.round(value * 100)}%`;
			}
		}
		/** 一条用量进度的颜色等级：80% 起警告，95% 起危险。 */
		function levelFor(usedPercent) {
			return usedPercent >= 95 ? "danger" : usedPercent >= 80 ? "warning" : "normal";
		}
		/** 千分位；Intl 不可用时退回原值，不让一个格式化失败变成一次渲染失败。 */
		function tokenText(value) {
			try {
				return new Intl.NumberFormat().format(value);
			} catch {
				return String(value);
			}
		}
		/**
		* 快照里的「机器坐标」合成一句：plan_family 的机器值与实际应答的端点路径。
		*
		* 它们解释的是这份快照**怎么来的**，不是用户现在该做什么，所以不进正文；但也绝不
		* 删除——调用方把它们放进本组的折叠区。没有任何值时返回 null，折叠区便少这一段。
		*/
		function quotaMachineFactsText(quota, t) {
			if (quota === null) return null;
			const parts = [quota.planFamily !== null ? `${t.quotaPlanFamily}: ${quota.planFamily}` : null, quota.sources.length > 0 ? `${t.quotaSources}: ${quota.sources.join(" · ")}` : null].filter((part) => part !== null);
			return parts.length === 0 ? null : parts.join(" · ");
		}
		/** 档位 → 字典键。六个取值一一对应，没有兜底串。 */
		const EFFORT_LABEL_KEYS = {
			minimal: "effortMinimal",
			low: "effortLow",
			medium: "effortMedium",
			high: "effortHigh",
			xhigh: "effortXHigh",
			max: "effortMax"
		};
		/**
		* 一组补充说明的折叠区。
		*
		* 版面纪律是「标题 → 一句话 → 控件 → 折叠的补充说明」，所以每组只把真正必要的那一句
		* 留在正文，其余**原句**收进这里。折叠不是删除：每一句仍然渲染进 DOM，仍然在
		* textContent 里，只是默认不占版面。空段落先滤掉，全空的组干脆不画这个折叠区。
		*/
		function moreNotes(summary, paragraphs) {
			const kept = paragraphs.filter((line) => line !== null && line !== "");
			if (kept.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dshsc-details",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: summary }), kept.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: line }, `note:${index}`))]
			});
		}
		/**
		* 老式窗口的一行：已用百分比 + 重置时刻。
		*
		* `usedPercent` 为 null（上游没给有界额度）时说成「没给百分比」而不是画一条 0% 的条——
		* 「不知道」与「一点没花」在界面上必须长得不一样。
		*/
		function quotaWindowRow(window, index, t) {
			const name = quotaWindowKeyText(window.key, t);
			const measured = window.usedPercent !== null && Number.isFinite(window.usedPercent);
			const used = measured && window.usedPercent !== null ? Math.max(0, Math.min(100, window.usedPercent)) : 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshsc-quota-row",
				"data-level": measured ? levelFor(used) : "normal",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshsc-quota-name",
						title: window.key,
						children: name
					}),
					measured ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshsc-quota-track",
						role: "progressbar",
						"aria-label": `${name}: ${percentText(used / 100)} ${t.quotaUsed}`,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": used,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${used}%` } })
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshsc-quota-value",
						children: t.quotaUsedUnknown
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshsc-quota-value",
						children: measured ? percentText(used / 100) : t.quotaUsedUnknown
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshsc-quota-meta",
						children: window.resetsAt !== null && window.resetsAt > 0 ? `${t.quotaResets} ${formatDate(window.resetsAt)}` : t.quotaNoReset
					})
				]
			}, `${window.key}:${index}`);
		}
		function StepCodeSection({ onModelChange } = {}) {
			const { state, derived, actions } = useStepCodeSection({ onModelChange });
			const { status, loading, busy, error, connection, adoptResult, pasteValue, profile, pasteOpen, contextDrafts, savingModel, quotaAccount, quotaPassword, quotaToken } = state;
			const { accounts, models, contextModels, overrideCount, login, quota, authenticated, poolLabels, cache, cacheHitRatio: hitRatio, quotaCredential } = derived;
			const { setProfile, login: startLogin, cancelLogin, submitPaste, setPasteValue, togglePaste, adopt, clearAdoptResult, accountAction, setStrategy, toggleModel, setAllModels, saveContextWindow, resetContextWindow, resetAllContextWindows, updateContextDraft, setDefaultReasoningEffort, setCacheRequestParams, refreshQuota, refreshCatalog, testConnection, setQuotaAccount, setQuotaPassword, setQuotaToken, submitQuotaPassword, submitQuotaToken, clearQuotaCredential } = actions;
			const t = zh$2;
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsha-page",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsha-empty",
					children: t.loading
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: t.pageDesc
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.title })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.profile }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.profileHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "dsha-select",
									"aria-label": t.profile,
									value: profile,
									disabled: busy !== null,
									onChange: (event) => {
										if (isStepCodeProfile(event.currentTarget.value)) setProfile(event.currentTarget.value);
									},
									children: STEP_CODE_PROFILES.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value,
										children: profileText(value, t)
									}, value))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-label",
									children: t.region
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: regionLabel(profile, t)
								})]
							}),
							moreNotes(t.moreNotes, [t.profileHintExtra, t.regionHint])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts,
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						labels: poolLabels,
						busy,
						showQuota: true,
						onLogin: () => void startLogin(profile),
						onSetPrimary: (accountId) => void accountAction("set-primary", accountId),
						onDelete: (accountId) => void accountAction("delete", accountId),
						onClearCooldown: (accountId) => void accountAction("clear-cooldown", accountId),
						onRelogin: (accountId) => void accountAction("relogin", accountId),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						renderLoginActions: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsha-account-add-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								"aria-label": `${t.addAccount}（${profileText(profile, t)}）`,
								onClick: () => void startLogin(profile),
								children: busy === `login:${profile}` ? t.authorizing : t.addAccount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null,
								"aria-label": t.adopt,
								onClick: () => void adopt(),
								children: busy === "adopt" ? t.adopting : t.adopt
							})]
						}),
						renderDetails: (account) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.profile,
								": ",
								profileText(account.profile, t)
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t.region,
								": ",
								account.region === "cn" ? t.regionCn : t.regionIntl
							] }),
							account.accountName ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.accountName }) : null
						] }),
						children: [
							login !== null && login.status !== "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshsc-flow",
								children: [
									login.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.loginPending
										}),
										login.authorizeUrl !== void 0 && login.authorizeUrl !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-label",
												children: t.authorizeUrl
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: "dshsc-flow-url",
												children: login.authorizeUrl
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsha-actions",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
													className: "dsha-btn",
													href: login.authorizeUrl,
													target: "_blank",
													rel: "noreferrer noopener",
													children: t.openAuthorizeUrl
												})
											})
										] }),
										login.progress !== void 0 && login.progress !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsha-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-label",
												children: t.progress
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-value",
												children: login.progress
											})]
										}),
										login.pollIntervalSec !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.pollEvery.replace("{seconds}", String(login.pollIntervalSec))
										}),
										login.expiresAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.loginExpiresAt.replace("{time}", formatDate(login.expiresAt))
										})
									] }),
									login.status === "complete" && !authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.loginCompleteNoAccount
									}),
									login.status === "complete" && authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsha-notice",
										children: [t.loginComplete, login.uid !== void 0 && login.uid !== "" ? ` ${login.uid}` : ""]
									}), login.completedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.loginCompletedAt.replace("{time}", formatDate(login.completedAt))
									})] }),
									login.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-error",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: login.error !== void 0 && login.error !== "" ? `${t.loginError} ${login.error}` : t.loginError }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: login.retryable === true ? t.loginRetryable : t.loginNotRetryable })]
									}),
									login.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dsha-btn",
											disabled: busy !== null,
											onClick: () => void cancelLogin(),
											children: busy === "login:cancel" ? t.cancelLoginBusy : t.cancelLogin
										})
									})
								]
							}),
							adoptResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsha-value",
									children: adoptResult.adopted ? t.adoptAdopted.replace("{profile}", profileText(adoptResult.profile ?? profile, t)) : adoptResult.reason === void 0 ? t.adoptNoAttempt : `${adoptReasonText(adoptResult.reason, t)} ${t.adoptFallback}`
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: clearAdoptResult,
									children: t.dismiss
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshsc-paste",
								children: [
									login !== null && login.status === "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-muted dshsc-paste-note",
										children: authenticated ? t.loginHaveAccounts.replace("{count}", String(accounts.length)) : t.loginIdle
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsha-btn",
										"aria-expanded": pasteOpen,
										"aria-controls": "dshsc-paste-body",
										onClick: togglePaste,
										children: t.manualPasteSection
									}),
									pasteOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshsc-paste-body",
										id: "dshsc-paste-body",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsha-muted",
											children: t.manualPasteHint
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshsc-paste-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "password",
												className: "dsha-select",
												"aria-label": t.manualPasteSection,
												placeholder: t.manualPastePlaceholder,
												value: pasteValue,
												disabled: busy !== null,
												onChange: (event) => setPasteValue(event.currentTarget.value),
												onKeyDown: (event) => {
													if (event.key === "Enter") submitPaste();
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-btn dsha-btn-primary",
												disabled: busy !== null || pasteValue.trim() === "",
												onClick: () => void submitPaste(),
												children: busy === "login-manual" ? t.manualPasteSubmitting : t.manualPasteSubmit
											})]
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: status?.serving === false && status.conflict ? t.routeConflict.replace("{detail}", status.conflict) : t.routeOwned
							}),
							connection !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: connection.connected ? "dsha-muted" : "dsha-notice",
								children: connection.connected ? [
									t.testSuccess,
									t.testLatency.replace("{ms}", String(connection.latencyMs)),
									connection.account?.alias ?? connection.account?.accountName ?? null,
									connection.model ?? null
								].filter((part) => part !== null && part !== "").join(" · ") : t.testFailedDetail.replace("{detail}", connection.error ?? "—")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void testConnection(),
									children: busy === "connection" ? t.testingConnection : t.testConnection
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.cacheSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.cacheStatScope
							}),
							cache === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.cacheEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-meter-wrap",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-label",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.cacheHitRatio }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: hitRatio === null ? t.cacheHitRatioUnavailable : percentText(hitRatio) })]
											}),
											hitRatio !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: `dsha-meter ${hitRatio >= .9 ? "dsha-meter-green" : "dsha-meter-cyan"}`,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.round(hitRatio * 100)}%` } })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsha-meter-meta",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheReadTokens,
														": ",
														tokenText(cache.cacheReadTokens)
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheMissedTokens,
														": ",
														tokenText(cache.missedInputTokens)
													] }),
													cache.requests !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														t.cacheRequests,
														": ",
														tokenText(cache.requests)
													] })
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsha-label",
											children: t.cacheWriteNote
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsha-value",
											children: [
												t.cacheWriteNoteValue,
												": ",
												tokenText(cache.cacheWriteTokens),
												" · ",
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dshsc-mono",
													children: CACHE_WRITE_NOTE
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsha-muted",
										children: t.cacheWriteNoteHint
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.cacheRequestParams }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: status?.cacheRequestParams === true ? t.cacheRequestParamsOnHint : t.cacheRequestParamsHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "dsha-label",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										"aria-label": t.cacheRequestParams,
										checked: status?.cacheRequestParams === true,
										disabled: busy !== null,
										onChange: (event) => void setCacheRequestParams(event.currentTarget.checked)
									})
								})]
							}),
							moreNotes(t.moreNotes, [
								t.cacheDesc,
								`${t.cacheFieldOrder}: ${STEP_CODE_CACHE_READ_FIELD_ORDER.join(" → ")}`,
								t.cachePricingNote,
								t.cacheRequestParamsNote
							])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null,
									onClick: () => void refreshCatalog(),
									children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted dsha-models-hint",
								children: t.modelsHint
							}),
							models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.modelsUnavailable
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: models.map((model) => ({
									id: model.id,
									name: model.name,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: toggleModel,
								onToggleAll: setAllModels,
								labels: {
									selectAll: t.selectAll,
									clearAll: t.unselectAll,
									countTemplate: t.modelChecklistCount,
									list: t.modelsSection
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.enabledModelIdsSemantics
							})] }),
							moreNotes(t.moreNotes, [t.modelsHintExtra])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.defaultEffort })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsha-muted",
									children: t.defaultEffortHint
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsha-select",
									"aria-label": t.defaultEffort,
									value: status?.defaultReasoningEffort ?? "",
									disabled: busy !== null,
									onChange: (event) => {
										const value = event.currentTarget.value;
										setDefaultReasoningEffort(isStepCodeReasoningEffort(value) ? value : null);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t.defaultEffortModel
									}), Object.entries(EFFORT_LABEL_KEYS).map(([effort, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: effort,
										children: t[key]
									}, effort))]
								})]
							}),
							moreNotes(t.moreNotes, [t.defaultEffortHintExtra])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.contextWindowHint
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: contextModels.map((model) => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									meta: model.defaultContextWindow < model.contextWindow ? formatCapacity(model.contextWindow) : void 0,
									inputLabel: `${model.name} ${t.contextWindowSection}`,
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								metaClassName: "dshsc-model-meta",
								onDraftChange: updateContextDraft,
								onCommit: (id) => void saveContextWindow(id),
								onReset: (id) => void resetContextWindow(id),
								onResetAll: () => void resetAllContextWindows()
							}),
							moreNotes(t.moreNotes, [t.contextWindowHintExtra])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaSection }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !authenticated,
									onClick: () => void refreshQuota(),
									children: busy === "quota" ? t.quotaRefreshing : t.quotaRefresh
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: poolLabels.quotaFactsScope
							}),
							status?.quotaRefreshing === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: t.quotaRefreshingNote
							}),
							status?.quotaError !== void 0 && status.quotaError !== null && status.quotaError !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-notice",
								children: `${t.quotaErrorLabel}: ${status.quotaError}`
							}),
							!authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.quotaSignedOut
							}) : quota === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: busy === "quota" ? t.quotaRefreshing : t.quotaEmpty
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-quota-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-quota-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: quota.planName !== null && quota.planName !== "" ? quota.planName : t.quotaPlan }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quotaKindText(quota.kind, t) })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dshsc-fact-grid",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshsc-fact",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.quotaRenews }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatDate(quota.renewsAt) })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshsc-fact",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.quotaReadAt }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatDate(quota.fetchedAt) })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dshsc-fact",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.quotaRegion }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota.region === "cn" ? t.regionCn : t.regionIntl })]
											})
										]
									}),
									quota.kind === "windowed" && quota.windows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dshsc-quota-list",
										children: quota.windows.map((window, index) => quotaWindowRow(window, index, t))
									}),
									quota.kind === "windowed" && quota.windows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									quota.kind === "credit" && quota.creditBuckets.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dshsc-quota-list",
										children: quota.creditBuckets.map((bucket, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dshsc-bucket",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsha-label",
													children: `${t.quotaWindowCredit} #${index + 1}`
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsha-value",
													children: [
														t.quotaBucketRemaining,
														": ",
														tokenText(bucket.remaining),
														" / ",
														tokenText(bucket.total)
													]
												}),
												bucket.expiresAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dshsc-quota-meta",
													children: [
														t.quotaBucketExpires,
														": ",
														formatDate(bucket.expiresAt)
													]
												}),
												bucket.resetsAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dshsc-quota-meta",
													children: [
														t.quotaBucketResets,
														": ",
														formatDate(bucket.resetsAt)
													]
												})
											]
										}, `bucket:${index}`))
									}),
									quota.kind === "credit" && quota.creditBuckets.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: t.quotaEmpty
									}),
									quota.kind === "unknown" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-empty",
										children: quotaKindText("unknown", t)
									})
								]
							}),
							moreNotes(t.moreNotes, [
								t.quotaDesc,
								t.quotaWindowNames,
								t.quotaKindHint,
								quotaMachineFactsText(quota, t)
							])
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-grouphead",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.quotaCredentialSection })
							}),
							quotaCredential === null || quotaCredential.hasCredential !== true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-empty",
								children: t.quotaCredentialNone
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.quotaCredentialSource
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: quotaCredentialSourceText(quotaCredential.source, t)
									})]
								}),
								quotaCredential.account !== void 0 && quotaCredential.account !== null && quotaCredential.account !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.quotaCredentialAccount
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: quotaCredential.account
									})]
								}),
								quotaCredential.expiresAt !== void 0 && quotaCredential.expiresAt !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsha-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-label",
										children: t.quotaCredentialExpires
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsha-value",
										children: formatDate(quotaCredential.expiresAt)
									})]
								}),
								quotaCredential.error !== void 0 && quotaCredential.error !== null && quotaCredential.error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsha-notice",
									children: `${t.quotaCredentialError}: ${quotaCredential.error}`
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsha-actions",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null,
										onClick: () => void clearQuotaCredential(),
										children: busy === "quota-credential:clear" ? t.quotaCredentialClearing : t.quotaCredentialClear
									})
								})
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshsc-cred-block",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									className: "dshsc-cred-title",
									children: t.quotaCredentialPasswordSection
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshsc-cred-grid",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											className: "dsha-select",
											"aria-label": t.quotaCredentialAccount,
											placeholder: t.quotaCredentialAccountPlaceholder,
											value: quotaAccount,
											disabled: busy !== null,
											autoComplete: "off",
											onChange: (event) => setQuotaAccount(event.currentTarget.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "password",
											className: "dsha-select",
											"aria-label": t.quotaCredentialPasswordPlaceholder,
											placeholder: t.quotaCredentialPasswordPlaceholder,
											value: quotaPassword,
											disabled: busy !== null,
											autoComplete: "new-password",
											onChange: (event) => setQuotaPassword(event.currentTarget.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "dsha-btn dsha-btn-primary",
											disabled: busy !== null || quotaAccount.trim() === "" || quotaPassword === "",
											onClick: () => void submitQuotaPassword(),
											children: busy === "quota-credential:password" ? t.quotaCredentialPasswordSubmitting : t.quotaCredentialPasswordSubmit
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshsc-cred-block",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									className: "dshsc-cred-title",
									children: t.quotaCredentialManualSection
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshsc-cred-grid dshsc-cred-grid-narrow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "password",
										className: "dsha-select",
										"aria-label": t.quotaCredentialTokenPlaceholder,
										placeholder: t.quotaCredentialTokenPlaceholder,
										value: quotaToken,
										disabled: busy !== null,
										autoComplete: "off",
										onChange: (event) => setQuotaToken(event.currentTarget.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null || quotaToken === "",
										onClick: () => void submitQuotaToken(),
										children: busy === "quota-credential:manual" ? t.quotaCredentialTokenSubmitting : t.quotaCredentialTokenSubmit
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsha-muted",
								children: t.quotaCredentialFoot
							})
						]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsha-error",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: error })
					})
				]
			});
		}
		//#endregion
		//#region src/client/hub/providers.tsx
		/** One POST to a line's settings endpoint, answered with that line's refreshed status. */
		async function postLineSettings(prefix, body) {
			const response = await fetch(`${prefix}/settings`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const envelope = await response.json();
			if (!response.ok || !envelope.ok) {
				const error = envelope.error;
				throw new Error(typeof error === "object" && error !== null ? error.message ?? "Request failed" : String(error ?? "Request failed"));
			}
		}
		async function setChatGptEnabled(enabled) {
			const response = await fetch(`${ROUTE_PREFIX}/preferences/update`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ enabled })
			});
			const envelope = await response.json();
			if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message ?? "Request failed");
		}
		/** Card order on the overview; also the former tab order. */
		const HUB_PROVIDERS = [
			{
				id: "chatgpt",
				name: "ChatGPT",
				setEnabled: setChatGptEnabled,
				renderDetail: ({ t, onModelChange, runtime }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CodexSubscriptionSection, {
					t,
					onModelChange,
					...runtime
				})
			},
			{
				id: "antigravity",
				name: "Antigravity",
				setEnabled: (enabled) => postLineSettings("/wb/antigravity/api", { enabled }),
				renderDetail: ({ onModelChange }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AntigravitySection, { onModelChange })
			},
			{
				id: "workbuddy",
				name: "WorkBuddy 订阅",
				setEnabled: (enabled) => postLineSettings("/wb/workbuddy/api", { enabled }),
				renderDetail: ({ onModelChange }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkBuddySection, { onModelChange })
			},
			{
				id: "vertex",
				name: "Vertex AI 服务账号",
				setEnabled: (enabled) => postLineSettings("/wb/workbuddy/vertex/api", { enabled }),
				renderDetail: ({ onModelChange }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VertexSection, { onModelChange })
			},
			{
				id: "aistudio",
				name: "Google AI Studio",
				setEnabled: (enabled) => postLineSettings("/wb/aistudio/api", { enabled }),
				renderDetail: ({ onModelChange }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AiStudioSection, { onModelChange })
			}
		];
		function hubProviderDescriptor(id) {
			return HUB_PROVIDERS.find((provider) => provider.id === id);
		}
		//#endregion
		//#region src/client/hub/HubOverview.tsx
		/**
		* The hub's opening screen: one card per provider line, in the QQ-mail
		* account-picker idiom — a brand tile, the line's name, a one-line annotation
		* (accounts, models, state), and exactly two interactions per card: the
		* enable switch and drilling into the line's detail page.
		*
		* Data comes from the host's aggregated read-only overview route, so opening
		* the settings page costs one request and never touches an upstream service.
		* Switch commits go to each line's own settings endpoint (see providers.tsx)
		* and update optimistically; a failed commit rolls the switch back and says
		* so in the card's annotation line, where the user is already looking.
		*/
		async function fetchOverview() {
			const response = await fetch(HUB_OVERVIEW_PATH, { credentials: "same-origin" });
			const envelope = await response.json();
			if (!response.ok || !envelope.ok) throw new Error(envelope.ok ? `Request failed (${response.status})` : envelope.error.message);
			return envelope.value;
		}
		/** The card's one-line annotation: accounts, then models, then state. */
		function cardAnnotation(summary, descriptor, t) {
			if (summary === void 0) return "…";
			if (summary.error === true) return t("hubStatusFailed");
			const parts = [];
			if (summary.canToggle && !summary.enabled) parts.push(t("hubStateDisabled"));
			parts.push(summary.accountCount > 0 ? formatPoolLabel(t("hubAccountCount"), { count: summary.accountCount }) : t("hubNoAccounts"));
			if (summary.enabledModelCount !== null) parts.push(summary.totalModelCount !== null ? formatPoolLabel(t("hubModelsEnabledOfTotal"), {
				count: summary.enabledModelCount,
				total: summary.totalModelCount
			}) : formatPoolLabel(t("hubModelsEnabled"), { count: summary.enabledModelCount }));
			return parts.join(" · ");
		}
		function HubOverview({ t, onOpen }) {
			const [summaries, setSummaries] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(null);
			const [busyId, setBusyId] = (0, react.useState)(null);
			const [toggleErrors, setToggleErrors] = (0, react.useState)(/* @__PURE__ */ new Map());
			const load = (0, react.useCallback)(async () => {
				try {
					const overview = await fetchOverview();
					setSummaries(new Map(overview.providers.map((provider) => [provider.id, provider])));
					setLoadError(null);
				} catch (error) {
					setLoadError(error instanceof Error ? error.message : String(error));
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const toggle = (0, react.useCallback)(async (descriptor, summary, enabled) => {
				if (descriptor.setEnabled === null) return;
				setBusyId(descriptor.id);
				setToggleErrors((current) => {
					if (!current.has(descriptor.id)) return current;
					const next = new Map(current);
					next.delete(descriptor.id);
					return next;
				});
				setSummaries((current) => new Map(current).set(descriptor.id, {
					...summary,
					enabled
				}));
				try {
					await descriptor.setEnabled(enabled);
					load();
				} catch (error) {
					setSummaries((current) => new Map(current).set(descriptor.id, {
						...summary,
						enabled: summary.enabled
					}));
					setToggleErrors((current) => new Map(current).set(descriptor.id, error instanceof Error ? error.message : String(error)));
				} finally {
					setBusyId(null);
				}
			}, [load]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-hub-overview",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsh-hub-hint",
					children: t("hubOverviewHint")
				}), loadError !== null && summaries === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-codex-errorbar",
					role: "alert",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: loadError }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsh-codex-button",
						onClick: () => void load(),
						children: t("retry")
					})]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-hub-cards",
					children: summaries === null ? HUB_PROVIDERS.map((descriptor) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-hub-skeleton",
						"aria-hidden": "true",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								flex: 1,
								display: "flex",
								flexDirection: "column"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-hub-skel-name" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-hub-skel-note" })]
						})]
					}, descriptor.id)) : HUB_PROVIDERS.map((descriptor) => {
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HubProviderCard, {
							descriptor,
							summary: summaries.get(descriptor.id),
							busy: busyId === descriptor.id,
							toggleError: toggleErrors.get(descriptor.id) ?? null,
							t,
							onOpen,
							onToggle: toggle
						}, descriptor.id);
					})
				})]
			});
		}
		const CHEVRON_SVG = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4l4 4-4 4\"/></svg>";
		function HubProviderCard(props) {
			const { descriptor, summary, t } = props;
			const enabled = summary?.enabled ?? true;
			const annotation = props.toggleError ?? cardAnnotation(summary, descriptor, t);
			const canToggle = descriptor.setEnabled !== null && (summary?.canToggle ?? true);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "button",
				tabIndex: 0,
				className: "dsh-hub-card",
				"data-enabled": enabled,
				"aria-label": formatPoolLabel(t("hubCardLabel"), {
					name: descriptor.name,
					annotation
				}),
				onClick: () => props.onOpen(descriptor.id),
				onKeyDown: (event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					if (event.target !== event.currentTarget) return;
					event.preventDefault();
					props.onOpen(descriptor.id);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandTile, { id: descriptor.id }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-hub-card-copy",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-hub-card-name",
							children: descriptor.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `dsh-hub-card-note${props.toggleError !== null || summary?.error === true ? " dsh-hub-note-danger" : ""}`,
							children: annotation
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-hub-card-side",
						children: [canToggle ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "switch",
							"aria-checked": enabled,
							"aria-label": formatPoolLabel(t(enabled ? "hubSwitchOff" : "hubSwitchOn"), { name: descriptor.name }),
							className: "dsh-hub-switch",
							disabled: props.busy || summary === void 0,
							onClick: (event) => {
								event.stopPropagation();
								if (summary === void 0) return;
								props.onToggle(descriptor, summary, !enabled);
							}
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-hub-chevron",
							"aria-hidden": "true",
							dangerouslySetInnerHTML: { __html: CHEVRON_SVG }
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/ProviderHubSection.tsx
		const STORAGE_KEY = "dsh-workbuddy-subscription:hub-view";
		/**
		* The detail page a user was last on survives a settings-page remount, so a
		* provider toggle deep in a detail page never throws them back to the
		* overview. Session storage, not local: a new browser session starts at the
		* overview, which is the page's whole point.
		*/
		function readStoredView() {
			try {
				const raw = sessionStorage.getItem(STORAGE_KEY);
				if (raw === null) return { view: "overview" };
				const parsed = JSON.parse(raw);
				if (parsed.view !== "detail" || typeof parsed.id !== "string") return { view: "overview" };
				return hubProviderDescriptor(parsed.id) === void 0 ? { view: "overview" } : {
					view: "detail",
					id: parsed.id
				};
			} catch {
				return { view: "overview" };
			}
		}
		function storeView(view) {
			try {
				sessionStorage.setItem(STORAGE_KEY, JSON.stringify(view));
			} catch {}
		}
		const BACK_SVG = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 4l-4 4 4 4\"/></svg>";
		/**
		* Single settings page hosting every subscription provider. The opening
		* screen is the overview — one card per line with its enable switch and
		* account count — and picking a card replaces it with that line's detail
		* page under a back bar. Only the active view is mounted, mirroring the
		* shell's behavior of mounting just the selected settings page (each
		* provider section refetches its status on mount).
		*/
		function ProviderHubSection({ t, onModelChange, ...runtime }) {
			const [view, setView] = (0, react.useState)(readStoredView);
			const open = (0, react.useCallback)((id) => {
				const next = {
					view: "detail",
					id
				};
				storeView(next);
				setView(next);
			}, []);
			const back = (0, react.useCallback)(() => {
				const next = { view: "overview" };
				storeView(next);
				setView(next);
			}, []);
			if (view.view === "overview") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh-codex-page",
				"aria-labelledby": "dsh-hub-title",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					id: "dsh-hub-title",
					className: "dsh-codex-title",
					children: t("hubTitle")
				}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HubOverview, {
					t,
					onOpen: open
				})]
			});
			const descriptor = hubProviderDescriptor(view.id) ?? HUB_PROVIDERS[0];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh-codex-page",
				"aria-labelledby": "dsh-hub-detail-name",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
					className: "dsh-hub-backbar",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsh-hub-back",
						onClick: back,
						"aria-label": t("hubBack"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							dangerouslySetInnerHTML: { __html: BACK_SVG }
						}), t("hubBack")]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-hub-backbar-name",
						id: "dsh-hub-detail-name",
						children: descriptor.name
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-hub-detail",
					children: descriptor.renderDetail({
						t,
						onModelChange,
						runtime
					})
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-chatgpt-subscription";
		const dictionaries$1 = {
			zh: {
				...accountPoolZh,
				title: "ChatGPT",
				hubTitle: "自制渠道",
				refreshCatalog: "刷新模型目录",
				refreshingCatalog: "刷新中…",
				intro: "使用 ChatGPT 账号登录，在 DSH 中使用订阅可用的模型。",
				account: "账号",
				signedOut: "尚未登录",
				signedIn: "已登录",
				plan: "套餐",
				accountId: "账号 ID",
				expires: "令牌到期",
				signIn: "使用 ChatGPT 登录",
				signInAgain: "重新登录",
				cancel: "取消登录",
				signOut: "注销",
				refreshToken: "刷新凭据",
				pending: "请在浏览器中完成登录。",
				popupBlocked: "浏览器拦截了登录窗口，请使用下面的链接继续。",
				continueLogin: "打开 ChatGPT 登录页",
				loading: "正在读取状态…",
				connection: "连接",
				testConnection: "测试连接",
				testing: "测试中…",
				latency: "最近延迟",
				selectAll: "全选",
				unselectAll: "全不选",
				models: "可用模型",
				modelsHint: "勾选后模型才会显示在对话页的模型选择列表中；全部取消勾选或关闭上方开关可在列表中隐藏该供应商。",
				proxySettings: "网络代理",
				proxyMode: "代理模式",
				proxyModeHint: "GPT 与 Antigravity（Gemini）共用此代理设置；支持自动读取系统代理，修改后对后续请求生效。",
				proxyModeAuto: "系统代理（自动检测）",
				proxyModeCustom: "自定义代理",
				proxyModeDirect: "直连（禁用代理）",
				customProxyUrl: "自定义代理地址",
				customProxyUrlHint: "支持 HTTP/HTTPS/SOCKS5 代理地址，例如 http://127.0.0.1:7890",
				customProxyUrlPlaceholder: "例如: http://127.0.0.1:7890",
				saveProxyUrl: "保存代理地址",
				proxyDetected: "检测到系统代理",
				proxyDetectedEffective: "（已自动生效）",
				proxyNoneDetected: "未检测到系统代理，将使用直连",
				proxyDirectHint: "所有网络请求将直接连接，不经过任何代理服务器。",
				enhancements: "增强功能",
				fastMode: "快速模式（1.5x 速度）",
				fastModeHint: "提升 Token 生成速度至约 1.5 倍；将以约 2x–2.5x 速度消耗 Codex 订阅额度。",
				outputVerbosity: "输出详细程度",
				outputVerbosityHint: "控制 Codex 最终回答的详细程度；不影响思考深度。默认值与官方 Codex 客户端一致（低）。",
				verbosityLow: "低（保持回答简洁）",
				verbosityMedium: "中（兼顾细节与简洁）",
				verbosityHigh: "高（在回答中包含更多细节）",
				reasoningSummary: "推理摘要",
				reasoningSummaryHint: "选择 ChatGPT 总结其推理的方式；不影响思考深度。默认值与官方 Codex 客户端一致（不生成摘要，可省额度）。",
				summaryAuto: "自动（让模型选择摘要详细程度）",
				summaryConcise: "简洁（显示简要推理摘要）",
				summaryDetailed: "详细（显示更详细的推理摘要）",
				summaryNone: "无（不显示推理摘要）",
				searchProvider: "搜索来源",
				searchProviderHint: "选择 DSH 联网搜索使用默认来源，或改用当前 ChatGPT 订阅的 Codex 来源（自动走代理隧道）。抓取模式为 auto 时，抓取来源跟随此选择。",
				searchProviderDsh: "DSH 默认",
				searchProviderCodex: "ChatGPT（代理隧道）",
				fetchStatus: "抓取来源（只读）",
				fetchStatusHint: "以下内容由 Host 上报，只读展示。",
				fetchConfiguredProvider: "配置的抓取 Provider",
				fetchProviderDshDefault: "DSH 默认（Host 未固定抓取 provider）",
				switcherState: "抓取选择器状态",
				switcherStateIdle: "空闲（尚未应用选择）",
				switcherStateApplying: "应用中（正在切换 Host 的 web provider）",
				switcherStateApplied: "已应用",
				switcherStateMissing: "未找到可切换的 web 服务",
				switcherStateFailed: "切换失败，请检查 Host 日志",
				fetchMode: "抓取模式",
				fetchModeAuto: "auto（有可用代理或选了 ChatGPT 搜索时用插件抓取）",
				fetchModePlugin: "plugin（始终用本插件抓取）",
				fetchModeDsh: "dsh（保留 DSH 原有抓取来源）",
				fetchMaxBodyChars: "插件正文上限",
				fetchMaxResponseBytes: "插件响应体上限",
				characters: "字符",
				bytes: "字节",
				fetchLimitsInactive: "仅在实际使用插件抓取时生效；走 DSH 原有抓取来源时不适用这两个上限。",
				fetchConfigSource: "模式与上限在插件 Config 中修改（不是本页面偏好），修改后重载插件或重启 DSH 生效。",
				providerDefault: "使用 Provider 默认值",
				contextWindows: "模型上下文窗口",
				contextWindowsHint: "只列出已勾选「可用模型」的条目。默认取模型目录值（GPT-6 系列 384K，最高 872K；其余最高 1M），该值用于 DSH 的压缩与溢出判断，可输入 872K、512K 等容量；改过的模型可单独或一键恢复默认。",
				contextWindow: "上下文窗口",
				contextWindowInvalid: "上下文窗口必须是正整数，且不能超过模型上限（GPT-6 系列为 872K，其余为 1M）；可使用 K 或 M 后缀。",
				contextWindowReset: "恢复默认",
				contextWindowResetAll: "全部恢复默认",
				contextWindowResetAllConfirm: "确定把已改过的模型上下文窗口全部恢复为默认值吗？",
				contextWindowsNoneEnabled: "还没有勾选任何模型。在上方「可用模型」里勾选后，这里会出现该模型的上下文窗口设置。",
				saveContextWindow: "保存上下文窗口",
				save: "保存",
				tokens: "tokens",
				quickQuota: "在输入框旁显示快捷用量",
				quickQuotaHint: "仅在当前会话选中 codex-chatgpt 模型时显示。",
				quota: "用量与限额",
				quotaIntro: "数据来自 ChatGPT Codex 用量服务。页面可见时最多每 60 秒刷新一次。",
				refreshQuota: "刷新用量",
				refreshing: "刷新中…",
				noQuota: "当前套餐未返回可显示的限额窗口。",
				quotaSignedOut: "登录后可查看订阅限额。",
				stale: "显示的是上次成功获取的数据。",
				updated: "更新时间",
				primary: "主要窗口",
				secondary: "次要窗口",
				limitWindow: "额度",
				used: "已使用",
				remaining: "剩余",
				available: "可用",
				unavailable: "不可用",
				unlimited: "无限",
				credits: "Credits",
				monthlySpend: "月度消费控制",
				resetCredits: "重置次数",
				resetCreditExpires: "到期时间",
				useResetCredit: "使用重置卡",
				usingResetCredit: "使用中…",
				useResetCreditConfirm: "使用后会立即消耗 1 次重置机会，并重置符合条件的 Codex 额度窗口。确定继续吗？",
				resetCreditUsed: "重置卡已使用，用量数据已刷新。",
				spendControlReached: "已触发月度消费控制，新的订阅调用可能被限制。",
				limit: "上限",
				exhausted: "额度已用尽",
				resets: "重置",
				quickQuotaLabel: "Codex 剩余",
				quickQuotaLoading: "用量…",
				quickQuotaRefresh: "点击刷新 Codex 剩余额度",
				quickQuotaRefreshing: "刷新中…",
				quickQuotaRefreshFailed: "刷新失败，点击重试",
				imageToolRunning: "正在生成图片",
				imageToolDone: "已生成图片",
				imageToolFailed: "图片生成失败",
				image: "图片",
				openImage: "打开图片",
				openNamedImage: "打开 {name}",
				imageLoading: "加载图片…",
				imageLoadFailed: "图片加载失败，点击重试",
				imagePreviewClose: "关闭",
				imagePreviewOpenOriginal: "打开原图",
				retry: "重试",
				unknown: "未知",
				hubBack: "自制渠道",
				hubOverviewHint: "选择供应商以管理账号、模型与配额；右侧开关控制该供应商是否出现在模型列表中。",
				hubAccountCount: "{count} 个账号",
				hubNoAccounts: "暂无账号，点击进入添加",
				hubStateEnabled: "已启用",
				hubStateDisabled: "已停用",
				hubModelsEnabled: "{count} 个模型可用",
				hubModelsEnabledOfTotal: "{count}/{total} 个模型可用",
				hubStatusFailed: "状态读取失败",
				hubSwitchOn: "启用 {name}",
				hubSwitchOff: "停用 {name}",
				hubCardLabel: "{name}，{annotation}",
				localCodexLoginImport: "导入本机 Codex CLI 登录",
				localCodexLoginImporting: "导入中…",
				stopImporting: "停止导入全部本机登录",
				stopImportingLabel: "停止导入全部本机登录（当前 {count} 个）",
				stopImportingBusy: "停止导入中…",
				stopImportingHint: "停止导入只会让本插件忘记本机 CLI 登录的副本；Codex CLI 自己的登录文件不会被删除或修改。账号池不允许逐条删除借来的凭据，所以这里一次会停止全部导入。",
				modelChecklistCount: "已启用 {count}/{total}"
			},
			en: {
				...accountPoolEn,
				title: "ChatGPT",
				hubTitle: "Custom Channels",
				refreshCatalog: "Refresh catalog",
				refreshingCatalog: "Refreshing…",
				intro: "Sign in with ChatGPT to use models available to your subscription in DSH.",
				account: "Account",
				signedOut: "Not signed in",
				signedIn: "Signed in",
				plan: "Plan",
				accountId: "Account ID",
				expires: "Token expires",
				signIn: "Sign in with ChatGPT",
				signInAgain: "Sign in again",
				cancel: "Cancel sign-in",
				signOut: "Sign out",
				refreshToken: "Refresh credentials",
				pending: "Complete sign-in in your browser.",
				popupBlocked: "The sign-in window was blocked. Use the link below to continue.",
				continueLogin: "Open ChatGPT sign-in",
				loading: "Reading status…",
				connection: "Connection",
				testConnection: "Test connection",
				testing: "Testing…",
				latency: "Last latency",
				selectAll: "Select all",
				unselectAll: "Unselect all",
				models: "Available models",
				modelsHint: "Checked models appear in the conversation model picker; unchecking all or turning off the switch hides this provider from the picker.",
				proxySettings: "Network Proxy",
				proxyMode: "Proxy Mode",
				proxyModeHint: "GPT and Antigravity (Gemini) share these proxy settings. Supports system proxy detection; changes apply to subsequent requests.",
				proxyModeAuto: "System Proxy (Auto-detect)",
				proxyModeCustom: "Custom Proxy",
				proxyModeDirect: "Direct (No Proxy)",
				customProxyUrl: "Custom Proxy URL",
				customProxyUrlHint: "Supports HTTP/HTTPS/SOCKS5 proxy URLs, e.g. http://127.0.0.1:7890",
				customProxyUrlPlaceholder: "e.g. http://127.0.0.1:7890",
				saveProxyUrl: "Save Proxy URL",
				proxyDetected: "Detected system proxy",
				proxyDetectedEffective: " (active)",
				proxyNoneDetected: "No system proxy detected; connecting directly",
				proxyDirectHint: "All requests connect directly without using any proxy server.",
				enhancements: "Enhancements",
				fastMode: "Fast mode (1.5x speed)",
				fastModeHint: "Generates tokens ~1.5x faster; consumes Codex subscription quota at ~2x–2.5x the normal rate.",
				outputVerbosity: "Output verbosity",
				outputVerbosityHint: "Controls the detail level of final Codex answers without changing reasoning effort. The default matches the official Codex client (low).",
				verbosityLow: "Low (keep answers concise)",
				verbosityMedium: "Medium (balance detail and brevity)",
				verbosityHigh: "High (include more detail)",
				reasoningSummary: "Reasoning summary",
				reasoningSummaryHint: "Controls how ChatGPT summarizes its chain of thought; does not change reasoning depth. The default matches the official Codex client (no summary, which saves quota).",
				summaryAuto: "Auto (let model determine detail)",
				summaryConcise: "Concise (brief summary)",
				summaryDetailed: "Detailed (in-depth summary)",
				summaryNone: "None (hide reasoning summary)",
				searchProvider: "Search provider",
				searchProviderHint: "Choose whether DSH web search uses the default provider or the Codex proxy-backed source from this ChatGPT subscription. Fetch mode \"auto\" follows this choice.",
				searchProviderDsh: "DSH default",
				searchProviderCodex: "ChatGPT (Proxy tunnel)",
				fetchStatus: "Fetch source (read-only)",
				fetchStatusHint: "Reported by the host. Read-only.",
				fetchConfiguredProvider: "Configured fetch provider",
				fetchProviderDshDefault: "DSH default (the host pins no fetch provider)",
				switcherState: "Fetch switcher state",
				switcherStateIdle: "Idle (no selection applied yet)",
				switcherStateApplying: "Applying (host web provider switch in progress)",
				switcherStateApplied: "Applied",
				switcherStateMissing: "No web service found to switch",
				switcherStateFailed: "Switch failed, check the host log",
				fetchMode: "Fetch mode",
				fetchModeAuto: "auto (fetches with the plugin when a proxy is available or the ChatGPT search source is selected)",
				fetchModePlugin: "plugin (always fetch with this plugin)",
				fetchModeDsh: "dsh (keep the DSH default fetch source)",
				fetchMaxBodyChars: "Plugin body limit",
				fetchMaxResponseBytes: "Plugin response limit",
				characters: "chars",
				bytes: "bytes",
				fetchLimitsInactive: "Only applied when the plugin actually fetches; the DSH default fetch source does not use these two limits.",
				fetchConfigSource: "Mode and limits are changed in the plugin Config, not in these settings; they take effect after a plugin reload or a DSH restart.",
				providerDefault: "Use provider default",
				contextWindows: "Model context windows",
				contextWindowsHint: "Lists the models checked under Available models. Each starts at its catalog value (384K for the GPT-6 family, up to 872K; up to 1M otherwise); DSH uses it for compaction and overflow detection. Values such as 872K and 512K are accepted, and a changed model can be restored one by one or all at once.",
				contextWindow: "Context window",
				contextWindowInvalid: "The context window must be a positive integer within the model limit (872K for the GPT-6 family, 1M otherwise). K and M suffixes are accepted.",
				contextWindowReset: "Restore default",
				contextWindowResetAll: "Restore all defaults",
				contextWindowResetAllConfirm: "Restore every changed model context window to its default?",
				contextWindowsNoneEnabled: "No model is checked yet. Check one under Available models above and its context window setting appears here.",
				saveContextWindow: "Save context window",
				save: "Save",
				tokens: "tokens",
				quickQuota: "Show quick usage beside the composer",
				quickQuotaHint: "Shown only when the current session uses a codex-chatgpt model.",
				quota: "Usage and limits",
				quotaIntro: "Data comes from the ChatGPT Codex usage service and refreshes at most once per minute while visible.",
				refreshQuota: "Refresh usage",
				refreshing: "Refreshing…",
				noQuota: "Your plan did not return any displayable limit windows.",
				quotaSignedOut: "Sign in to view subscription limits.",
				stale: "Showing the last successfully fetched data.",
				updated: "Updated",
				primary: "Primary window",
				secondary: "Secondary window",
				limitWindow: "limit",
				used: "used",
				remaining: "remaining",
				available: "Available",
				unavailable: "Unavailable",
				unlimited: "Unlimited",
				credits: "Credits",
				monthlySpend: "Monthly spend control",
				resetCredits: "Reset credits",
				resetCreditExpires: "Expires",
				useResetCredit: "Use reset credit",
				usingResetCredit: "Using…",
				useResetCreditConfirm: "This immediately spends one reset credit and resets eligible Codex limit windows. Continue?",
				resetCreditUsed: "The reset credit was used and usage data was refreshed.",
				spendControlReached: "Monthly spend control has been reached; new subscription calls may be limited.",
				limit: "Limit",
				exhausted: "Quota exhausted",
				resets: "Resets",
				quickQuotaLabel: "Codex left",
				quickQuotaLoading: "Usage…",
				quickQuotaRefresh: "Click to refresh remaining Codex usage",
				quickQuotaRefreshing: "Refreshing…",
				quickQuotaRefreshFailed: "Refresh failed; click to retry",
				imageToolRunning: "Generating image",
				imageToolDone: "Generated image",
				imageToolFailed: "Image generation failed",
				image: "Image",
				openImage: "Open image",
				openNamedImage: "Open {name}",
				imageLoading: "Loading image…",
				imageLoadFailed: "Image failed to load. Click to retry",
				imagePreviewClose: "Close",
				imagePreviewOpenOriginal: "Open original",
				retry: "Retry",
				unknown: "Unknown",
				hubBack: "Custom Channels",
				hubOverviewHint: "Pick a provider to manage its accounts, models and quota. The switch controls whether it appears in the model picker.",
				hubAccountCount: "{count} accounts",
				hubNoAccounts: "No accounts yet — open to add one",
				hubStateEnabled: "Enabled",
				hubStateDisabled: "Disabled",
				hubModelsEnabled: "{count} models available",
				hubModelsEnabledOfTotal: "{count}/{total} models available",
				hubStatusFailed: "Status unavailable",
				hubSwitchOn: "Enable {name}",
				hubSwitchOff: "Disable {name}",
				hubCardLabel: "{name}, {annotation}",
				localCodexLoginImport: "Import the local Codex CLI sign-in",
				localCodexLoginImporting: "Importing…",
				stopImporting: "Stop importing all local sign-ins",
				stopImportingLabel: "Stop importing all local sign-ins ({count} currently imported)",
				stopImportingBusy: "Stopping the import…",
				stopImportingHint: "Stopping the import only makes this plugin forget its copy of the local CLI sign-in; the Codex CLI own sign-in file is never deleted or changed. The account pool does not allow deleting a borrowed credential one at a time, so this stops every import at once.",
				modelChecklistCount: "{count}/{total} enabled"
			}
		};
		//#endregion
		//#region src/client/common/plugin-style.ts
		/**
		* Shared installer for every stylesheet this plugin injects.
		*
		* The DSH client module system books stylesheet ownership by attribute. When a
		* package's factory materializes it claims every untagged `<style>` in the
		* document for itself (`style:not([data-plugin])` gains that package's id); when
		* a package reloads, is replaced at a new revision, or is pruned from the graph,
		* it removes every tag carrying its id. A sheet injected as a plain
		* `<style id=…>` therefore gets claimed by whichever sibling package
		* materializes next and is then deleted as that sibling's bookkeeping — which is
		* how the whole shared provider design system (`.dsha-*`) disappeared from the
		* settings page while the already-tagged chat-only `…/main` sheet survived.
		*
		* Tagging every sheet with this package's own `data-plugin` and a unique
		* `data-plugin-css` keeps the module system from attributing it to another
		* package, and re-running the installer on every `apply()` restores it after one
		* of our own reloads. The tag is owned by the document: the installer refreshes
		* stale text but never removes the element, so a stale fiber's teardown can
		* never take the styles away.
		*/
		const PLUGIN_ID = "dsh-workbuddy-subscription";
		function installPluginStyle(name, css, legacyId) {
			if (typeof document === "undefined") return () => void 0;
			const pluginCss = `${PLUGIN_ID}/${name}`;
			let element = document.querySelector(`style[data-plugin-css="${pluginCss}"]`);
			element ??= legacyId === void 0 ? null : document.getElementById(legacyId);
			if (element === null) {
				element = document.createElement("style");
				if (legacyId !== void 0) element.id = legacyId;
				document.head.appendChild(element);
			}
			element.dataset.plugin = PLUGIN_ID;
			element.dataset.pluginCss = pluginCss;
			if (element.textContent !== css) element.textContent = css;
			return () => void 0;
		}
		//#endregion
		//#region src/client/styles.ts
		const CSS$3 = `
.dsh-codex-page{box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:20px;max-width:780px;min-width:0;padding:2px 0 30px}
.dsh-codex-page *{box-sizing:border-box}
.dsh-codex-title{font-size:15px;font-weight:650;line-height:1.4;margin:0 0 5px}
.dsh-codex-intro,.dsh-codex-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55;margin:0}
.dsh-codex-group{border-top:0.5px solid var(--dsw-alias-border-l2);min-width:0}
.dsh-codex-grouphead{align-items:center;display:flex;gap:12px;justify-content:space-between;min-height:48px}
.dsh-codex-grouphead h3{font-size:14px;font-weight:650;margin:0}
.dsh-codex-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:20px;justify-content:space-between;min-height:44px;padding:8px 0}
.dsh-codex-label{color:var(--dsw-alias-label-secondary);font-size:13px;flex:0 0 auto}
.dsh-codex-value{font-size:13px;min-width:0;overflow-wrap:anywhere;text-align:right}
.dsh-codex-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding-top:12px}
.dsh-codex-button{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:13px;line-height:1;padding:8px 13px;white-space:nowrap}
.dsh-codex-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-codex-button:focus-visible,.dsh-codex-link:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-codex-button:disabled{cursor:default;opacity:.5}
.dsh-codex-button-primary{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent;color:var(--dsw-alias-button-info-label,#fff)}
.dsh-codex-notice{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;margin:12px 0 0;padding:10px 12px}
.dsh-codex-error,.dsh-codex-warning,.dsh-codex-success{font-size:12px;line-height:1.5;margin:8px 0 0}
.dsh-codex-error{color:var(--dsw-alias-label-danger,#d94b4b)}
.dsh-codex-warning{color:var(--dsw-alias-label-warning,#c77a18)}
.dsh-codex-success{color:var(--dsw-alias-label-success,#2e9b62)}
.dsh-codex-errorbar{align-items:center;background:color-mix(in srgb,var(--dsw-alias-label-danger,#d94b4b) 9%,transparent);border:0.5px solid color-mix(in srgb,var(--dsw-alias-label-danger,#d94b4b) 28%,transparent);border-radius:7px;color:var(--dsw-alias-label-danger,#d94b4b);display:flex;font-size:13px;gap:12px;justify-content:space-between;padding:10px 12px}
.dsh-codex-link{color:var(--dsw-alias-label-link,#3278d4);display:inline-block;font-size:13px;margin-top:8px}
.dsh-codex-pref-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:16px;justify-content:space-between;min-height:58px;padding:10px 0}
.dsh-codex-pref-row strong,.dsh-codex-check strong{display:block;font-size:13px;font-weight:600;line-height:1.35}
.dsh-codex-segments{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;display:inline-flex;flex-wrap:nowrap;gap:3px;padding:3px}
.dsh-codex-segments label{cursor:pointer;display:block;margin:0}
.dsh-codex-segments input{position:absolute;opacity:0;pointer-events:none}
.dsh-codex-segments span,.dsh-codex-segments button{border:0.5px solid transparent;border-radius:6px;color:var(--dsw-alias-label-secondary);display:block;font:inherit;font-size:12px;font-weight:500;line-height:1.2;padding:6px 12px;transition:all .15s ease;user-select:none;white-space:nowrap}
.dsh-codex-segments button{background:transparent;cursor:pointer}
.dsh-codex-segments label:hover span,.dsh-codex-segments button:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dsh-codex-segments input:checked+span,.dsh-codex-segments button.active,.dsh-codex-segments button[aria-pressed=true]{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 22%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 60%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.dsh-codex-segments input:focus-visible+span,.dsh-codex-segments button:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-codex-segments input:disabled+span,.dsh-codex-segments button:disabled{cursor:default;opacity:.5}
.dsh-codex-select,.dsh-codex-capacity-control input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:7px 9px}
.dsh-codex-select{max-width:210px;min-width:150px}
.dsh-codex-context-settings{border-bottom:0.5px solid var(--dsw-alias-border-l2);display:grid;gap:10px;padding:12px 0}
.dsh-codex-context-settings>div>strong{font-size:13px;font-weight:600}
.dsh-codex-context-row{align-items:center;display:flex;font-size:12px;gap:14px;justify-content:space-between}
.dsh-codex-proxy-control{align-items:center;display:flex;gap:8px;width:100%}
.dsh-codex-proxy-control input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);flex:1;font:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;min-width:220px;padding:7px 10px;text-align:left}
.dsh-codex-proxy-status{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;flex-wrap:wrap;font-size:12px;gap:6px;margin:6px 0 0}
.dsh-codex-proxy-tag{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 18%,transparent);border:0.5px solid color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 45%,transparent);border-radius:4px;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;padding:2px 6px}
.dsh-codex-capacity-control{align-items:center;display:flex;gap:7px}
.dsh-codex-capacity-control input{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right;width:90px}
.dsh-codex-capacity-control input[type=number]{width:110px}
.dsh-codex-capacity-control small{color:var(--dsw-alias-label-tertiary);font-size:11px;width:42px}
.dsh-codex-context-save{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:8px 10px;white-space:nowrap}
.dsh-codex-context-save:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-codex-context-save:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-codex-context-save:disabled{cursor:default;opacity:.45}
.dsh-codex-check{align-items:flex-start;border-bottom:0.5px solid var(--dsw-alias-border-l2);cursor:pointer;display:flex;gap:10px;padding:12px 0}
.dsh-codex-check input{flex:none;margin-top:2px}
.dsh-codex-check small{color:var(--dsw-alias-label-secondary);display:block;font-size:12px;line-height:1.45;margin-top:2px}
.dsh-codex-quota-card{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;margin-top:12px;padding:12px}
.dsh-codex-quota-title{align-items:center;display:flex;font-size:13px;gap:8px;justify-content:space-between}
.dsh-codex-quota-title span{color:var(--dsw-alias-label-tertiary);font-size:11px;text-transform:uppercase}
.dsh-codex-quota-fact{align-items:flex-start;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;font-size:12px;gap:12px;justify-content:space-between;line-height:1.45;padding:10px 0}
.dsh-codex-quota-fact span{color:var(--dsw-alias-label-secondary);flex:none}
.dsh-codex-quota-fact strong{font-weight:600;min-width:0;overflow-wrap:anywhere;text-align:right}
.dsh-codex-reset-credits{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:16px;justify-content:space-between;padding:10px 0}
.dsh-codex-reset-credits-info{display:grid;font-size:12px;gap:2px;grid-template-columns:auto auto}
.dsh-codex-reset-credits-info>span{color:var(--dsw-alias-label-secondary)}
.dsh-codex-reset-credits-info>strong{font-weight:650;text-align:right}
.dsh-codex-reset-credits-info>small{color:var(--dsw-alias-label-tertiary);font-size:11px;grid-column:1/-1}
.dsh-codex-meter-wrap{margin-top:13px}
.dsh-codex-meter-label,.dsh-codex-meter-meta{display:flex;gap:10px;justify-content:space-between}
.dsh-codex-meter-label{font-size:12px;margin-bottom:6px}
.dsh-codex-meter-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.45;margin-top:6px}
.dsh-codex-meter{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.15));border-radius:999px;corner-shape:round;height:7px;overflow:hidden;width:100%}
.dsh-codex-meter>span{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:inherit;display:block;height:100%;max-width:100%;min-width:0;transition:width .25s ease}
.dsh-codex-meter-warning>span{background:var(--dsw-alias-label-warning,#d58a24)}
.dsh-codex-meter-danger>span{background:var(--dsw-alias-label-danger,#d94b4b)}
.dsh-codex-empty{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-tertiary);font-size:12px;margin:12px 0 0;padding:16px;text-align:center}
.dsh-codex-timestamp{color:var(--dsw-alias-label-tertiary);font-size:11px;margin:10px 0 0;text-align:right}
.dsh-codex-skeleton{display:grid;gap:9px;padding-top:10px}
.dsh-codex-skeleton span{animation:dsh-codex-pulse 1.4s ease-in-out infinite;background:var(--dsw-alias-bg-layer-2);border-radius:5px;height:42px}
.dsh-codex-skeleton span:nth-child(2){animation-delay:.12s}.dsh-codex-skeleton span:nth-child(3){animation-delay:.24s}
.dsh-codex-sr{height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;clip:rect(0 0 0 0);white-space:nowrap}
.dsh-codex-composer-quota{align-items:center;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-secondary);display:inline-flex;font-size:11px;gap:6px;height:28px;line-height:1;max-width:160px;padding:0 9px;white-space:nowrap}
.dsh-codex-composer-quota{font-family:inherit;cursor:pointer}
.dsh-codex-composer-quota:disabled{cursor:wait;opacity:.65}
.dsh-codex-composer-quota:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}
.dsh-codex-composer-quota strong{color:var(--dsw-alias-label-primary);font-size:11px;font-weight:650}
.dsh-codex-composer-quota[data-level=warning] strong{color:var(--dsw-alias-label-warning,#d58a24)}
.dsh-codex-composer-quota[data-level=danger] strong{color:var(--dsw-alias-label-danger,#d94b4b)}
.dsh-codex-image-tool{border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;display:flex;flex-direction:column;gap:8px;margin:4px 0 4px 4px;max-width:520px;padding:10px 12px}
.dsh-codex-image-tool-head{align-items:center;display:flex;font-size:13px;gap:8px;min-width:0}
.dsh-codex-image-dot{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:50%;corner-shape:round;display:inline-block;flex:none;height:8px;width:8px}
.dsh-codex-image-tool[data-state=error] .dsh-codex-image-dot{background:var(--dsw-alias-label-danger,#d94b4b)}
.dsh-codex-image-title{font-weight:600}
.dsh-codex-image-summary{color:var(--dsw-alias-label-tertiary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-codex-image-grid{display:flex;flex-wrap:wrap;gap:8px}
.dsh-codex-image-preview{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;display:block;max-height:260px;max-width:min(100%,360px);object-fit:contain}
.dsh-codex-image-loading,.dsh-codex-image-failed{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-tertiary);display:inline-flex;font-size:12px;line-height:1.4;padding:18px 20px}
.dsh-codex-image-failed{color:var(--dsw-alias-label-danger,#d94b4b)}
@keyframes dsh-codex-pulse{0%,100%{opacity:.45}50%{opacity:.85}}
@media(max-width:560px){.dsh-codex-row,.dsh-codex-pref-row,.dsh-codex-quota-fact,.dsh-codex-reset-credits{align-items:flex-start;flex-direction:column;gap:3px}.dsh-codex-value,.dsh-codex-quota-fact strong{text-align:left}.dsh-codex-actions{justify-content:flex-start}.dsh-codex-grouphead{align-items:flex-start;flex-direction:column;gap:0;padding:12px 0}.dsh-codex-meter-meta{align-items:flex-start;flex-direction:column;gap:2px}.dsh-codex-errorbar{align-items:flex-start;flex-direction:column}.dsh-codex-segments{width:100%}.dsh-codex-select{max-width:none;width:100%}.dsh-codex-context-row{align-items:flex-start;flex-direction:column;gap:5px}.dsh-codex-segments label{flex:1}.dsh-codex-segments span{text-align:center}.dsh-codex-image-tool{max-width:100%;margin-left:0}}
@media(prefers-reduced-motion:reduce){.dsh-codex-meter>span{transition:none}.dsh-codex-skeleton span{animation:none}}
`;
		/**
		* Install the ChatGPT tab's stylesheet as a document-owned, never-removed
		* `<style>` element.
		*
		* The other client stylesheets this plugin installs are additive: their
		* installers no-op when the element already exists and their disposers do
		* nothing, so a restart can never take the styles away. This one used to
		* create *and remove* its element, and the dedupe handoff was racy: on a
		* plugin fiber restart (config change, dependency reload, HMR) the new fiber
		* ran `apply()` before the old fiber's async unload removed the element —
		* dedupe saw the old tag, returned a no-op disposer, and the old unload then
		* deleted the only copy. Every later restart kept returning the no-op, so the
		* stylesheet never came back and the settings page rendered unstyled.
		*
		* Fix: treat the tag as owned by the document rather than by one fiber —
		* create it when missing, refresh `textContent` when a rebuilt bundle ships
		* different CSS (HMR), and return a no-op disposer unconditionally, matching
		* the additive installers.
		*
		* Every other sheet this plugin injects now goes through the same installer
		* (`installPluginStyle`), which additionally stamps the ownership attributes
		* the client module system needs so the tag cannot be claimed by, and later
		* removed with, some other package.
		*/
		function installStyles() {
			return installPluginStyle("main", CSS$3);
		}
		//#endregion
		//#region src/client/hub/hub-styles.ts
		/**
		* Styles for the subscription hub: the overview's provider cards, the detail
		* page's back bar, and the provider switch. Installed through the shared
		* installer so the module system never claims the sheet (see
		* common/plugin-style.ts). Colors ride DSH theme tokens, so dark mode needs
		* no branch of its own.
		*/
		const CSS$2 = `
.dsh-hub-overview{display:flex;flex-direction:column;min-width:0}
.dsh-hub-hint{color:var(--dsw-alias-label-secondary,#5d5c52);font-size:13px;line-height:1.55;margin:0 0 14px}
.dsh-hub-cards{border-top:0.5px solid var(--dsw-alias-border-l2,#eceadf)}
.dsh-hub-card{align-items:center;background:transparent;border:none;border-bottom:0.5px solid var(--dsw-alias-border-l2,#eceadf);color:var(--dsw-alias-label-primary,#141413);cursor:pointer;display:flex;gap:14px;font:inherit;min-height:68px;padding:12px 6px;text-align:left;width:100%}
.dsh-hub-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.dsh-hub-card:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:-2px}
.dsh-hub-card[data-enabled=false] .dsh-hub-card-name,.dsh-hub-card[data-enabled=false] .dsh-hub-card-note{opacity:.55}
.dsh-hub-card-copy{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
.dsh-hub-card-name{font-size:14px;font-weight:600;line-height:1.3}
.dsh-hub-card-note{color:var(--dsw-alias-label-tertiary,#8f8d84);font-size:12px;line-height:1.4}
.dsh-hub-card-note.dsh-hub-note-danger{color:var(--dsw-alias-label-danger,#d94b4b)}
.dsh-hub-card-side{align-items:center;display:flex;flex:none;gap:10px}
.dsh-hub-chevron{color:var(--dsw-alias-label-caption,#a6a094);display:inline-flex;flex:none}
.dsh-hub-brand-tile{align-items:center;background:color-mix(in srgb,var(--dsh-hub-brand,#888) 10%,transparent);border-radius:10px;display:inline-flex;flex:none;justify-content:center;overflow:hidden}
.dsh-hub-brand-tile>svg{display:block}
.dsh-hub-brand-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px;font-weight:700;line-height:1}
.dsh-hub-switch{background:var(--dsw-alias-bg-layer-2,#f2f1ea);border:0.5px solid var(--dsw-alias-border-l2,#e3e1d5);border-radius:999px;box-sizing:border-box;cursor:pointer;flex:none;height:24px;padding:2px;position:relative;transition:background .15s ease,border-color .15s ease;width:44px}
.dsh-hub-switch::after{background:var(--dsw-alias-bg-layer-1,#fff);border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.28);content:"";display:block;height:19px;transition:transform .15s ease;width:19px}
.dsh-hub-switch[aria-checked=true]{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent}
.dsh-hub-switch[aria-checked=true]::after{transform:translateX(20px)}
.dsh-hub-switch:disabled{cursor:default;opacity:.5}
.dsh-hub-switch:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-hub-skeleton{border-bottom:0.5px solid var(--dsw-alias-border-l2,#eceadf);display:flex;gap:14px;min-height:68px;padding:12px 6px;align-items:center}
.dsh-hub-skeleton i{background:var(--dsw-alias-bg-layer-2,#f2f1ea);border-radius:10px;display:block;height:40px;width:40px}
.dsh-hub-skeleton span{background:var(--dsw-alias-bg-layer-2,#f2f1ea);border-radius:5px;display:block;height:12px}
.dsh-hub-skeleton .dsh-hub-skel-name{width:120px;margin-bottom:6px}
.dsh-hub-skeleton .dsh-hub-skel-note{width:180px;height:10px}
.dsh-hub-backbar{align-items:center;display:flex;gap:10px;margin-bottom:14px;min-height:32px}
.dsh-hub-back{align-items:center;background:transparent;border:none;border-radius:6px;color:var(--dsw-alias-label-secondary,#5d5c52);cursor:pointer;display:inline-flex;font:inherit;font-size:13px;font-weight:550;gap:2px;padding:5px 8px 5px 2px}
.dsh-hub-back:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#141413)}
.dsh-hub-back:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-hub-back svg{display:block}
.dsh-hub-backbar-name{color:var(--dsw-alias-label-tertiary,#8f8d84);font-size:13px;font-weight:600}
/* In the hub's detail page the back bar already names the provider, so the
   section's own page-level title would read as a duplicate. The intro line
   under it stays — it describes the line, not the location. Only ChatGPT's
   section renders such a header; the other seven begin with their content. */
.dsh-hub-detail .dsha-page>header .dsh-codex-title{display:none}
.dsh-hub-detail .dsha-page>header{margin-bottom:4px}
`;
		function installHubStyles() {
			installPluginStyle("hub", CSS$2);
		}
		//#endregion
		//#region src/client/common/model-checklist-styles.ts
		/**
		* Styles for the shared ModelChecklist (see ModelChecklist.tsx). Row metrics
		* and hover follow the claude-style model picker so the settings list and the
		* conversation picker read as one surface.
		*/
		const CSS$1 = `
.dsh-mcl{display:flex;flex-direction:column;min-width:0;padding:4px 0 2px}
.dsh-mcl-head{align-items:center;display:flex;justify-content:space-between;min-height:28px;padding:2px 2px 6px}
.dsh-mcl-count{color:var(--dsw-alias-label-caption,#a6a094);font-size:11px;letter-spacing:.02em}
.dsh-mcl-head-actions{display:inline-flex;gap:4px}
.dsh-mcl-action{background:transparent;border:none;border-radius:5px;color:var(--dsw-alias-label-link,#3278d4);cursor:pointer;font:inherit;font-size:12px;padding:3px 7px}
.dsh-mcl-action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsh-mcl-action:disabled{cursor:default;opacity:.45}
.dsh-mcl-action:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:2px}
.dsh-mcl-list{display:flex;flex-direction:column;gap:1px}
.dsh-mcl-option{align-items:center;background:transparent;border:none;border-radius:6px;color:var(--dsw-alias-label-primary,#141413);cursor:pointer;display:flex;font:inherit;gap:9px;min-height:34px;padding:3px 8px;text-align:left;width:100%}
.dsh-mcl-option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.dsh-mcl-option:disabled{cursor:default;opacity:.55}
.dsh-mcl-option:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#397ee8);outline-offset:-2px}
.dsh-mcl-option>svg{flex:none}
.dsh-mcl-copy{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
.dsh-mcl-name{font-size:13px;font-weight:500;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mcl-hint{color:var(--dsw-alias-label-tertiary,#8f8d84);font-size:11px;line-height:14px}
.dsh-mcl-option[data-enabled=false] .dsh-mcl-name,.dsh-mcl-option[data-enabled=false] .dsh-mcl-hint{opacity:.6}
.dsh-mcl-check{align-items:center;background:var(--dsw-alias-bg-layer-2,#f2f1ea);border:0.5px solid var(--dsw-alias-border-l1,#e8e6dc);border-radius:50%;color:transparent;display:inline-flex;flex:none;height:18px;justify-content:center;transition:background .12s ease,border-color .12s ease,color .12s ease;width:18px}
.dsh-mcl-option[aria-checked=true] .dsh-mcl-check{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent;color:var(--dsw-alias-button-info-label,#fff)}
.dsh-mcl-option:hover:not(:disabled) .dsh-mcl-check{border-color:var(--dsw-alias-button-info-fill,#397ee8)}
`;
		function installModelChecklistStyles() {
			installPluginStyle("model-checklist", CSS$1);
		}
		//#endregion
		//#region src/client/antigravity/styles.ts
		const STYLE_ID$6 = "dsh-antigravity-settings-style";
		function installAntigravityStyles() {
			installPluginStyle("antigravity", `
.dsha-page{box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:20px;max-width:780px;min-width:0;padding:2px 0 30px}
.dsha-page *{box-sizing:border-box}
.dsha-group{border-top:0.5px solid var(--dsw-alias-border-l2);min-width:0}
.dsha-group:first-of-type{border-top:0}
.dsha-grouphead{align-items:center;display:flex;gap:12px;justify-content:space-between;min-height:48px}
.dsha-grouphead h3{font-size:14px;font-weight:650;margin:0;color:var(--dsw-alias-label-primary)}
.dsha-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:20px;justify-content:space-between;min-height:44px;padding:8px 0}
.dsha-label{color:var(--dsw-alias-label-secondary);font-size:13px;flex:0 0 auto}
.dsha-value{font-size:13px;min-width:0;overflow-wrap:anywhere;text-align:right;color:var(--dsw-alias-label-primary)}
.dsha-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding-top:12px}
.dsha-btn{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:13px;line-height:1;padding:8px 13px;white-space:nowrap}
.dsha-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsha-btn:disabled{cursor:default;opacity:.5}
.dsha-btn-primary{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent;color:var(--dsw-alias-button-info-label,#fff)}
.dsha-btn-primary:hover:not(:disabled){opacity:.9}
.dsha-notice{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;margin:12px 0 0;padding:10px 12px}
.dsha-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55;margin:0}
.dsha-models-hint{padding-top:10px}
.dsha-pref-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:16px;justify-content:space-between;min-height:58px;padding:10px 0}
.dsha-pref-row strong{display:block;font-size:13px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-primary)}
.dsha-select{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:7px 9px;max-width:220px;min-width:160px}
.dsha-context-settings{border-bottom:0.5px solid var(--dsw-alias-border-l2);display:grid;gap:10px;padding:12px 0}
.dsha-context-settings>div>strong{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsha-context-row{align-items:center;display:flex;font-size:12px;gap:14px;justify-content:space-between}
.dsha-capacity-control{align-items:center;display:flex;gap:7px}
.dsha-capacity-control input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;padding:7px 9px;text-align:right;width:90px}
.dsha-capacity-control small{color:var(--dsw-alias-label-tertiary);font-size:11px;width:42px}
.dsha-context-save{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:8px 10px;white-space:nowrap}
.dsha-context-save:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsha-context-save:disabled{cursor:default;opacity:.45}
.dsha-context-reset{color:var(--dsw-alias-label-secondary)}
.dsha-context-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dsha-quota-card{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;margin-top:12px;padding:12px}
.dsha-quota-title{align-items:center;display:flex;font-size:13px;gap:8px;justify-content:space-between;color:var(--dsw-alias-label-primary);font-weight:650}
.dsha-quota-title span{color:var(--dsw-alias-label-tertiary);font-size:11px;text-transform:uppercase}
.dsha-meter-wrap{margin-top:13px}
.dsha-meter-label,.dsha-meter-meta{display:flex;gap:10px;justify-content:space-between}
.dsha-meter-label{font-size:12px;margin-bottom:6px;color:var(--dsw-alias-label-primary)}
.dsha-meter-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.45;margin-top:6px}
.dsha-meter{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.15));border-radius:999px;corner-shape:round;height:7px;overflow:hidden;width:100%}
.dsha-meter>span{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:inherit;display:block;height:100%;max-width:100%;min-width:0;transition:width .25s ease}
.dsha-meter-green>span{background:var(--dsw-alias-label-success,#10b981)}
.dsha-meter-cyan>span{background:#06b6d4}
.dsha-timestamp{color:var(--dsw-alias-label-tertiary);font-size:11px;margin:10px 0 0;text-align:right}
.dsha-mini-btn{border:0;background:transparent;color:var(--dsw-alias-label-link,#397ee8);font-size:12px;line-height:18px;cursor:pointer;padding:0;margin-left:8px}
.dsha-mini-btn:hover{text-decoration:underline}
.dsha-empty{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-tertiary);font-size:12px;margin:12px 0 0;padding:16px;text-align:center}
.dsha-error{color:var(--dsw-alias-label-danger,#d94b4b);font-size:12px;margin:8px 0 0}
.dsha-composer-quota{align-items:center;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;font-size:11px;gap:6px;height:28px;line-height:1;max-width:160px;padding:0 9px;white-space:nowrap;user-select:none;transition:all .15s ease}
.dsha-composer-quota:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1,var(--dsw-alias-border-l2))}
.dsha-composer-quota strong{color:var(--dsw-alias-label-primary);font-size:11px;font-weight:650}
.dsha-composer-quota[data-level=warning] strong{color:var(--dsw-alias-label-warning,#d58a24)}
.dsha-composer-quota[data-level=danger] strong{color:var(--dsw-alias-label-danger,#d94b4b)}
.dsha-accounts-list{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.dsha-account-card{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s ease}
.dsha-account-card.active{border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 60%,var(--dsw-alias-border-l2))}
.dsha-account-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsha-account-identity{display:flex;align-items:center;gap:8px;min-width:0}
.dsha-account-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsha-badges{display:flex;align-items:center;gap:6px}
.dsha-badge{font-size:11px;line-height:1;padding:3px 7px;border-radius:4px;font-weight:550;white-space:nowrap}
.dsha-badge.primary{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-button-info-fill,#397ee8);border:0.5px solid color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 40%,transparent)}
.dsha-badge.active{background:color-mix(in srgb,var(--dsw-alias-label-success,#10b981) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-success,#10b981);border:0.5px solid color-mix(in srgb,var(--dsw-alias-label-success,#10b981) 40%,transparent)}
.dsha-badge.cooldown{background:color-mix(in srgb,var(--dsw-alias-label-warning,#d58a24) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-warning,#d58a24);border:0.5px solid color-mix(in srgb,var(--dsw-alias-label-warning,#d58a24) 40%,transparent)}
.dsha-account-details{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsha-account-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.dsha-account-actions .dsha-btn{padding:5px 10px;font-size:12px}
`, STYLE_ID$6);
		}
		//#endregion
		//#region src/client/common/styles.ts
		const POOL_STYLE_ID = "dsh-provider-pool-style";
		/**
		* Styles the shared account-pool card adds on top of the existing provider
		* stylesheets: the badge variants no single provider tab owned before.
		*
		* Additive on purpose — the shared `.dsha-*` block and each provider's own
		* tweaks keep living in their own modules, in the order the client installs
		* them, so nothing that already rendered changes appearance.
		*/
		function installPoolStyles() {
			installPluginStyle("pool", `
.dsha-badge.danger{background:color-mix(in srgb,var(--dsw-alias-label-danger,#d94b4b) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-danger,#d94b4b);border:0.5px solid color-mix(in srgb,var(--dsw-alias-label-danger,#d94b4b) 40%,transparent)}
.dsha-account-card .dsha-btn.danger{color:var(--dsw-alias-label-danger,#d94b4b)}
/* Quota inside one account row. It follows the account, so it sits with the
   account's identity, badges and timestamps rather than in a page-level block
   that could only ever describe whichever account was active when it was read. */
.dsha-account-quota{display:flex;flex-direction:column;gap:5px;margin-top:9px}
.dsha-account-quota-head{align-items:baseline;color:var(--dsw-alias-label-secondary);display:flex;font-size:11px;font-weight:600;gap:8px;letter-spacing:.02em}
.dsha-account-quota-head em{color:var(--dsw-alias-label-tertiary);font-style:normal;font-weight:400}
.dsha-account-quota-empty{color:var(--dsw-alias-label-tertiary);font-size:12px}
.dsha-account-quota-row{align-items:center;display:flex;font-size:12px;gap:8px}
.dsha-account-quota-name{color:var(--dsw-alias-label-secondary);flex:none;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The track is drawn even when nothing is used: an empty bar nobody can see
   leaves the row reading as a stray label next to a number. */
.dsha-account-quota-track{background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#8a8a8a) 16%,transparent);border-radius:999px;box-shadow:inset 0 0 0 0.5px var(--dsw-alias-border-l2);flex:1;height:6px;min-width:56px;overflow:hidden}
.dsha-account-quota-fill{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:999px;display:block;height:100%;min-width:2px;transition:width .2s ease}
.dsha-account-quota-row[data-level=warning] .dsha-account-quota-fill{background:var(--dsw-alias-label-warning,#d9913b)}
.dsha-account-quota-row[data-level=danger] .dsha-account-quota-fill{background:var(--dsw-alias-label-danger,#d94b4b)}
.dsha-account-quota-value{color:var(--dsw-alias-label-primary);flex:none;font-variant-numeric:tabular-nums;min-width:40px;text-align:right}
.dsha-account-quota-meta{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px;font-variant-numeric:tabular-nums}
@media(max-width:560px){.dsha-account-quota-meta{display:none}}
`, POOL_STYLE_ID);
		}
		//#endregion
		//#region src/client/common/ComposerQuotaBadge.tsx
		/**
		* The composer badge every subscription line shows beside the input.
		*
		* Six of these were near-identical copies: the same mount guard, the same 60 s
		* poll that only ticks while the tab is visible, the same "inert unless the
		* conversation is on this provider" rule, the same markup. What differed was the
		* part worth reading — how each line picks its most meaningful number — and that
		* is the only thing a line still supplies.
		*
		* Two details this shared shape depends on:
		*
		*   - the callbacks are held in refs. Every caller hands them over as an inline
		*     arrow, and a callback in the dependency array would restart the interval —
		*     and refetch — on every render. The copies this replaced were only safe
		*     because each was rendered with a stable prop, which is a property of the
		*     call site rather than of the badge;
		*   - `authenticated` is part of the status contract rather than a predicate a
		*     line could forget, so a signed-out line can never leave a stale badge up.
		*/
		/** The shared grading: 5% or less is critical, 20% or less warns. */
		function quotaLevel(remainingPercent) {
			return remainingPercent <= 5 ? "danger" : remainingPercent <= 20 ? "warning" : "normal";
		}
		function ComposerQuotaBadge(props) {
			const { directory, loadModelDirectory, providerId, label } = props;
			const modelState = useStore(directory);
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const mountedRef = (0, react.useRef)(false);
			const readRef = (0, react.useRef)(props.readStatus);
			const selectRef = (0, react.useRef)(props.selectFacts);
			readRef.current = props.readStatus;
			selectRef.current = props.selectFacts;
			const selected = modelState.current;
			const isSelected = selected?.provider === providerId;
			(0, react.useEffect)(() => {
				loadModelDirectory();
			}, [loadModelDirectory]);
			(0, react.useEffect)(() => {
				mountedRef.current = true;
				return () => {
					mountedRef.current = false;
				};
			}, []);
			const fetchStatus = (0, react.useCallback)(async (refresh) => {
				if (!mountedRef.current) return;
				setLoading(true);
				try {
					const data = await readRef.current(refresh);
					if (mountedRef.current) setStatus(data);
				} catch {} finally {
					if (mountedRef.current) setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				if (!isSelected) return;
				fetchStatus(false);
				const timer = window.setInterval(() => {
					if (document.visibilityState === "visible") fetchStatus(false);
				}, 6e4);
				return () => {
					window.clearInterval(timer);
				};
			}, [fetchStatus, isSelected]);
			const facts = (0, react.useMemo)(() => selectRef.current(status, selected?.model), [status, selected?.model]);
			if (!isSelected || status === null || !status.authenticated || facts === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsha-composer-quota",
				"data-level": facts.level,
				title: facts.tooltip,
				"aria-label": facts.tooltip,
				onClick: () => void fetchStatus(true),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsha-composer-quota-label",
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
					className: "dsha-composer-quota-val",
					children: loading ? "…" : facts.text
				})]
			});
		}
		//#endregion
		//#region src/client/antigravity/AntigravityComposerQuota.tsx
		const api$5 = createLineApi("/wb/antigravity/api", "Antigravity");
		/**
		* The bucket this badge should speak for, or null when it cannot speak for one.
		*
		* The service reports the same allowances under separate model groups, and a
		* bucket the service never measured must not be published as "0% left". So the
		* badge skips it and takes the next measured one in the group, and shows nothing
		* at all when the group has none. Falling back to another group's numbers would
		* label one allowance with another's reading.
		*
		* Exported for its own regression test; the badge is its only caller.
		*/
		function selectQuotaBucketForModel(groups, modelId) {
			if (!groups || groups.length === 0) return null;
			const isClaudeOrGpt = modelId ? /claude|gpt/i.test(modelId) : false;
			const targetGroup = groups.find((g) => {
				const match = /claude|gpt|3p/i.test(g.displayName);
				return isClaudeOrGpt ? match : !match;
			}) || groups[0];
			if (!targetGroup || !targetGroup.buckets || targetGroup.buckets.length === 0) return null;
			const measured = (bucket) => typeof bucket.remainingFraction === "number" && Number.isFinite(bucket.remainingFraction);
			const shortBucket = targetGroup.buckets.find((b) => /5\s*小时|hour|5h/i.test(b.displayName) && measured(b)) ?? targetGroup.buckets.find(measured);
			if (shortBucket === void 0) return null;
			const remaining = shortBucket.remainingFraction;
			if (typeof remaining !== "number" || !Number.isFinite(remaining)) return null;
			return {
				groupName: targetGroup.displayName,
				bucketName: shortBucket.displayName,
				remainingPercent: Math.round(remaining * 100),
				resetTime: shortBucket.resetTime
			};
		}
		function formatResetCountdown(resetTime) {
			if (!resetTime) return "";
			try {
				const diff = new Date(resetTime).getTime() - Date.now();
				if (diff <= 0) return "即将重置";
				const h = Math.floor(diff / 36e5);
				const m = Math.floor(diff % 36e5 / 6e4);
				if (h > 0) return `${h}小时${m}分后重置`;
				return `${m}分钟后重置`;
			} catch {
				return "";
			}
		}
		/** The allowance the selected model actually draws on, as the badge's facts. */
		function selectBadgeFacts$7(status, modelId) {
			if (status?.quotaError) return { text: "—", tooltip: `[Antigravity] ${status.quotaError}`, level: "warning" };
			const info = selectQuotaBucketForModel(status?.quota?.groups ?? [], modelId);
			if (info === null) return {
				text: "—",
				tooltip: "点击刷新 Antigravity 配额",
				level: "normal"
			};
			const countdown = info.resetTime ? formatResetCountdown(info.resetTime) : "";
			return {
				text: `${info.remainingPercent}%`,
				tooltip: `[Antigravity] ${info.groupName} - ${info.bucketName}: 剩余 ${info.remainingPercent}%${countdown ? ` (${countdown})` : ""}，点击刷新`,
				level: quotaLevel(info.remainingPercent)
			};
		}
		function AntigravityComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "antigravity",
				readStatus: async (refresh) => {
					if (!refresh) return api$5.get("/status");
					try { return await api$5.post("/quota"); }
					catch { return api$5.get("/status"); }
				},
				selectFacts: selectBadgeFacts$7,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/claude/ClaudeComposerQuota.tsx
		const api$4 = createLineApi("/wb/claude/api", "Claude");
		/**
		* Pick the most meaningful number for the badge.
		*
		* A subscription is bounded by several windows at once — a 5-hour one and a
		* weekly one, and sometimes a per-model weekly one as well. They are not
		* interchangeable: the short window can be spent while the long one has room and
		* the reverse, so the TIGHTEST *remaining* percentage is what the badge shows
		* and its own label names the tooltip. Choosing "the shortest window" instead
		* would be a guess about which one runs out first, and the payload already
		* answers that.
		*
		* NOTE ON DIRECTION: the wire reports `usedPercent`, which is PERCENT USED, so
		* remaining is 100 - used. A window at 0% used is the normal empty state and
		* grades as 'normal', not as an error.
		*/
		function selectBadgeFacts$6(status) {
			const quota = status?.quota;
			if (quota === null || quota === void 0) return {
				text: "—",
				tooltip: "[Claude] quota unavailable — click to refresh",
				level: "normal"
			};
			let tightest = null;
			for (const window of quota.windows) {
				const remaining = window.remainingPercent ?? (window.usedPercent === null ? null : 100 - window.usedPercent);
				if (remaining === null) continue;
				if (tightest === null || remaining < tightest.remaining) tightest = {
					label: window.label,
					remaining
				};
			}
			if (tightest === null) return {
				text: "—",
				tooltip: "[Claude] quota unavailable — click to refresh",
				level: "normal"
			};
			const remaining = Math.round(tightest.remaining);
			return {
				text: `${remaining}%`,
				tooltip: `[Claude] ${tightest.label}: ${remaining}% left`,
				level: quotaLevel(remaining)
			};
		}
		function ClaudeComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "claude-subscription",
				readStatus: (refresh) => refresh ? api$4.post("/quota") : api$4.get("/status"),
				selectFacts: selectBadgeFacts$6,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/claude/styles.ts
		const STYLE_ID$5 = "dsh-claude-settings-style";
		/**
		* Claude-only additions to the shared settings design system.
		*
		* The base control styles ('.dsha-page', '.dsha-group', '.dsha-models', the
		* account card, the meters, the composer badge, …) come from the stylesheet the
		* Kimi Code sibling installs, in the same order the client installs them, so
		* this file declares only what stays unique to this card — the same rule the
		* WorkBuddy and GLM cards follow.
		*
		* What stays unique here is the sign-in flow block and the borrowed-sign-in
		* markers, neither of which a sibling line renders.
		*/
		function installClaudeStyles() {
			installPluginStyle("claude", `
.dsha-badge.claude-adopted{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 16%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
.dshcl-flow{border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:10px;padding:12px 0}
.dshcl-flow-url{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere;padding:8px 10px;user-select:all}
.dshcl-paste{align-items:flex-start;display:flex;flex-direction:column;gap:8px}
.dshcl-paste-row{align-items:center;display:flex;flex-wrap:wrap;gap:8px}
.dshcl-paste-row input{flex:1 1 260px;min-width:200px}
.dshcl-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere}
.dshcl-model-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:5px}
.dshcl-empty-inline{color:var(--dsw-alias-label-tertiary);font-size:12px}
`, STYLE_ID$5);
		}
		//#endregion
		//#region src/client/command-code/CommandCodeComposerQuota.tsx
		const api$3 = createLineApi("/wb/command-code/api", "Command Code");
		/**
		* Pick the most meaningful number for the badge.
		*
		* A bounded usage window is the number a user actually spends down, so it wins
		* over a credit balance; the balance shows only when no window is reported.
		*/
		function selectBadgeFacts$5(status) {
			const quota = status?.quota;
			if (quota === null || quota === void 0) return {
				text: "—",
				tooltip: "Command Code quota unavailable — click to refresh",
				level: "normal"
			};
			const window = [...quota.windows ?? []].sort((a, b) => (a.windowDurationMins ?? Infinity) - (b.windowDurationMins ?? Infinity))[0];
			if (window !== void 0) {
				const remaining = Math.max(0, 100 - window.usedPercent);
				return {
					text: `${remaining}%`,
					tooltip: `[Command Code] ${window.label}: ${remaining}% left`,
					level: quotaLevel(remaining)
				};
			}
			const meter = (quota.meters ?? []).find((candidate) => candidate.remainingFraction !== null);
			if (meter !== void 0 && meter.remainingFraction !== null) {
				const remaining = Math.round(meter.remainingFraction * 100);
				return {
					text: `${remaining}%`,
					tooltip: `[Command Code] ${meter.label}: ${remaining}% left`,
					level: quotaLevel(remaining)
				};
			}
			if (quota.unlimited) return {
				text: "∞",
				tooltip: "[Command Code] Unlimited plan allowance",
				level: "normal"
			};
			if (quota.creditBalance !== null) return {
				text: quota.creditBalance,
				tooltip: `[Command Code] Remaining credits: ${quota.creditBalance}`,
				level: "normal"
			};
			return {
				text: "—",
				tooltip: "Command Code quota unavailable — click to refresh",
				level: "normal"
			};
		}
		function CommandCodeComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "command-code",
				readStatus: (refresh) => refresh ? api$3.post("/quota") : api$3.get("/status"),
				selectFacts: selectBadgeFacts$5,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/kimi-code/KimiCodeComposerQuota.tsx
		const api$2 = createLineApi("/wb/kimi-code/api", "Kimi Code");
		/**
		* Pick the most meaningful number for the badge.
		*
		* The shortest window is the one a user spends down first and the one that
		* blocks work soonest, so it wins over the longer pools; the 7-day allowance
		* shows only when no 5-hour window is reported.
		*/
		function selectBadgeFacts$4(status) {
			const quota = status?.quota;
			if (quota === null || quota === void 0) return {
				text: "—",
				tooltip: "[Kimi Code] quota unavailable — click to refresh",
				level: "normal"
			};
			const window = [...quota.windows ?? []].filter((candidate) => candidate.windowDurationMins !== null).sort((a, b) => (a.windowDurationMins ?? Infinity) - (b.windowDurationMins ?? Infinity))[0] ?? quota.windows[0];
			if (window !== void 0) {
				const remaining = Math.max(0, 100 - window.usedPercent);
				return {
					text: `${remaining}%`,
					tooltip: `[Kimi Code] ${window.label}: ${remaining}% left`,
					level: quotaLevel(remaining)
				};
			}
			const wallet = quota.extraUsage;
			if (wallet !== null && wallet !== void 0 && wallet.balanceCents !== null) {
				const amount = (wallet.balanceCents / 100).toFixed(2);
				return {
					text: amount,
					tooltip: `[Kimi Code] booster wallet: ${amount} ${wallet.currency ?? ""}`.trim(),
					level: "normal"
				};
			}
			return {
				text: "—",
				tooltip: "[Kimi Code] quota unavailable — click to refresh",
				level: "normal"
			};
		}
		function KimiCodeComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "kimi-code",
				readStatus: (refresh) => refresh ? api$2.post("/quota") : api$2.get("/status"),
				selectFacts: selectBadgeFacts$4,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/kimi-code/styles.ts
		const STYLE_ID$4 = "dsh-kimi-code-settings-style";
		/**
		* Node the base control styles come from.
		*
		* The Kimi Code card renders the same controls as the sibling routes, so it
		* reuses one extracted stylesheet verbatim rather than re-declaring a parallel
		* design system that would drift from it.
		*/
		const BASE = `
.dsha-page{box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:20px;max-width:780px;min-width:0;padding:2px 0 30px}
.dsha-page *{box-sizing:border-box}
.dsha-group{border-top:0.5px solid var(--dsw-alias-border-l2);min-width:0}
.dsha-group:first-of-type{border-top:0}
.dsha-grouphead{align-items:center;display:flex;gap:12px;justify-content:space-between;min-height:48px}
.dsha-grouphead h3{font-size:14px;font-weight:650;margin:0;color:var(--dsw-alias-label-primary)}
.dsha-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:20px;justify-content:space-between;min-height:44px;padding:8px 0}
.dsha-label{color:var(--dsw-alias-label-secondary);font-size:13px;flex:0 0 auto}
.dsha-value{font-size:13px;min-width:0;overflow-wrap:anywhere;text-align:right;color:var(--dsw-alias-label-primary)}
.dsha-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding-top:12px}
.dsha-btn{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:13px;line-height:1;padding:8px 13px;white-space:nowrap}
.dsha-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsha-btn:disabled{cursor:default;opacity:.5}
.dsha-btn-primary{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent;color:var(--dsw-alias-button-info-label,#fff)}
.dsha-btn-primary:hover:not(:disabled){opacity:.9}
.dsha-notice{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;margin:12px 0 0;padding:10px 12px}
.dsha-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55;margin:0}
.dsha-models-hint{padding-top:10px}
.dsha-pref-row{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;gap:16px;justify-content:space-between;min-height:58px;padding:10px 0}
.dsha-pref-row strong{display:block;font-size:13px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-primary)}
.dsha-select{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:7px 9px;max-width:220px;min-width:160px}
.dsha-context-settings{border-bottom:0.5px solid var(--dsw-alias-border-l2);display:grid;gap:10px;padding:12px 0}
.dsha-context-settings>div>strong{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsha-context-row{align-items:center;display:flex;font-size:12px;gap:14px;justify-content:space-between}
.dsha-capacity-control{align-items:center;display:flex;gap:7px}
.dsha-capacity-control input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;padding:7px 9px;text-align:right;width:90px}
.dsha-capacity-control small{color:var(--dsw-alias-label-tertiary);font-size:11px;width:42px}
.dsha-context-save{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:8px 10px;white-space:nowrap}
.dsha-context-save:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsha-context-save:disabled{cursor:default;opacity:.45}
.dsha-context-reset{color:var(--dsw-alias-label-secondary)}
.dsha-context-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dsha-quota-card{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;margin-top:12px;padding:12px}
.dsha-quota-title{align-items:center;display:flex;font-size:13px;gap:8px;justify-content:space-between;color:var(--dsw-alias-label-primary);font-weight:650}
.dsha-quota-title span{color:var(--dsw-alias-label-tertiary);font-size:11px;text-transform:uppercase}
.dsha-meter-wrap{margin-top:13px}
.dsha-meter-label,.dsha-meter-meta{display:flex;gap:10px;justify-content:space-between}
.dsha-meter-label{font-size:12px;margin-bottom:6px;color:var(--dsw-alias-label-primary)}
.dsha-meter-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.45;margin-top:6px}
.dsha-meter{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.15));border-radius:999px;corner-shape:round;height:7px;overflow:hidden;width:100%}
.dsha-meter>span{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:inherit;display:block;height:100%;max-width:100%;min-width:0;transition:width .25s ease}
.dsha-meter-green>span{background:var(--dsw-alias-label-success,#10b981)}
.dsha-meter-cyan>span{background:#06b6d4}
.dsha-timestamp{color:var(--dsw-alias-label-tertiary);font-size:11px;margin:10px 0 0;text-align:right}
.dsha-mini-btn{border:0;background:transparent;color:var(--dsw-alias-label-link,#397ee8);font-size:12px;line-height:18px;cursor:pointer;padding:0;margin-left:8px}
.dsha-mini-btn:hover{text-decoration:underline}
.dsha-empty{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-tertiary);font-size:12px;margin:12px 0 0;padding:16px;text-align:center}
.dsha-error{color:var(--dsw-alias-label-danger,#d94b4b);font-size:12px;margin:8px 0 0}
.dsha-composer-quota{align-items:center;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;font-size:11px;gap:6px;height:28px;line-height:1;max-width:160px;padding:0 9px;white-space:nowrap;user-select:none;transition:all .15s ease}
.dsha-composer-quota:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1,var(--dsw-alias-border-l2))}
.dsha-composer-quota strong{color:var(--dsw-alias-label-primary);font-size:11px;font-weight:650}
.dsha-composer-quota[data-level=warning] strong{color:var(--dsw-alias-label-warning,#d58a24)}
.dsha-composer-quota[data-level=danger] strong{color:var(--dsw-alias-label-danger,#d94b4b)}

.dsha-device-box{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;display:flex;flex-direction:column;gap:10px;margin-top:12px;padding:12px}
.dsha-code-row{align-items:center;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between}
.dsha-code{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:16px;font-weight:650;letter-spacing:.14em;padding:8px 12px}
.dsha-link{color:var(--dsw-alias-label-link,#397ee8);font-size:12px;overflow-wrap:anywhere;text-decoration:none}
.dsha-link:hover{text-decoration:underline}
.dsha-model-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:5px}
.dsha-badge{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-tertiary);font-size:10px;padding:2px 6px}
.dsha-cap-table{border-bottom:0.5px solid var(--dsw-alias-border-l2);padding:12px 0}
.dsha-cap-table table{border-collapse:collapse;font-size:11px;width:100%}
.dsha-cap-table th{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:500;padding:0 10px 6px 0;text-align:left;white-space:nowrap}
.dsha-cap-table th:last-child,.dsha-cap-table td:last-child{padding-right:0}
.dsha-cap-table td{border-top:0.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);padding:8px 10px 8px 0;vertical-align:top}
.dsha-cap-table td:first-child{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap}
.dsha-cap-table td:nth-child(2),.dsha-cap-table td:nth-child(3){white-space:nowrap}
.dsha-cap-on{color:var(--dsw-alias-label-primary);font-weight:500}
.dsha-cap-off{color:var(--dsw-alias-label-tertiary)}
.dsha-cap-notes{line-height:1.5;min-width:200px}
.dsha-cap-cost{color:var(--dsw-alias-label-primary);display:block;font-weight:500;margin-bottom:3px}
.dsha-cap-footnote{font-size:11px;line-height:1.55;margin:8px 0 0}
.dsha-warn{border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;line-height:1.55;margin:0 0 10px;padding:8px 10px}
`;
		/** Kimi-specific rules layered on top of the shared control styles. */
		function installKimiCodeStyles() {
			installPluginStyle("kimi-code", BASE, STYLE_ID$4);
		}
		//#endregion
		//#region src/client/minimax-code/MinimaxCodeComposerQuota.tsx
		const api$1 = createLineApi("/wb/minimax-code/api", "MiniMax Code");
		/**
		* Pick the badge facts for one status answer, or nothing at all.
		*
		* Quota is optional in the contract, and the usage read is allowed to fail (the
		* endpoint is undocumented and which host serves this subscription is
		* unmeasured), so a status without quota means the badge has nothing to say: it
		* is not rendered, rather than showing a placeholder that would read as a broken
		* meter. Callers must treat null as "hide the badge".
		*/
		function selectBadgeFacts$3(status) {
			const quota = status?.quota;
			if (quota === void 0) return null;
			if (quota.usedPercent !== void 0 && Number.isFinite(quota.usedPercent)) {
				const remaining = Math.max(0, Math.round(100 - quota.usedPercent));
				return {
					text: `${remaining}%`,
					tooltip: `[MiniMax Code] ${quota.label}: ${remaining}% left`,
					level: quotaLevel(remaining)
				};
			}
			return {
				text: quota.label,
				tooltip: `[MiniMax Code] ${quota.label}`,
				level: "normal"
			};
		}
		function MinimaxCodeComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "minimax-code",
				readStatus: () => api$1.get("/quota"),
				selectFacts: selectBadgeFacts$3,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/minimax-code/styles.ts
		const STYLE_ID$3 = "dsh-minimax-code-settings-style";
		/**
		* MiniMax Code-only additions to the shared settings design system.
		*
		* The base control styles (.dsha-page, .dsha-group, .dsha-row, .dsha-models,
		* the device-code box, the meter, the composer badge, ...) come from the
		* stylesheet the sibling routes install, in the same order the client installs
		* them, so this file declares only what stays unique to this card: the mono
		* credential path and the model-name list.
		*/
		function installMinimaxCodeStyles() {
			installPluginStyle("minimax-code", `
.dshm-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}
.dshm-model-list{display:flex;flex-wrap:wrap;gap:7px;padding-top:8px}
.dshm-model-list code{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;padding:5px 8px;white-space:nowrap}
.dshm-quota-note{margin-top:12px}
.dshm-reset-list{display:flex;flex-direction:column;gap:6px;padding-top:8px}
.dshm-reset-row{align-items:center;justify-content:space-between}
.dshm-reset-pick{background:none;border:0.5px solid var(--dsw-alias-border-l2);cursor:pointer;padding:4px 8px}
.dshm-reset-pick[aria-pressed="true"]{border-color:var(--dsw-alias-border-focus,var(--dsw-alias-border-l3));background:var(--dsw-alias-bg-layer-2)}
`, STYLE_ID$3);
		}
		//#endregion
		//#region src/client/workbuddy/WorkBuddyComposerQuota.tsx
		const api = createLineApi("/wb/workbuddy/api", "WorkBuddy");
		/**
		* Pick the most meaningful number for the badge.
		*
		* A bounded allowance is what a user spends down, so it wins over a bare credit
		* balance; the balance shows only when no percentage is reported. The billing
		* payload reports both a cycle meter and a package meter, and the cycle meter
		* is the one that actually resets, so it is preferred when both exist.
		*/
		function selectBadgeFacts$2(status) {
			const quota = status?.quota;
			if (quota === null || quota === void 0) return {
				text: "—",
				tooltip: "WorkBuddy quota unavailable — click to refresh",
				level: "normal"
			};
			const meter = (quota.meters ?? []).find((candidate) => candidate.id === "cycle" && candidate.remainingFraction !== null) ?? (quota.meters ?? []).find((candidate) => candidate.remainingFraction !== null);
			if (meter !== void 0 && meter.remainingFraction !== null) {
				const remaining = Math.round(meter.remainingFraction * 100);
				return {
					text: `${remaining}%`,
					tooltip: `[WorkBuddy] ${meter.label}: ${remaining}% left`,
					level: quotaLevel(remaining)
				};
			}
			if (quota.remainingCredits !== null) return {
				text: String(quota.remainingCredits),
				tooltip: `[WorkBuddy] Remaining credits: ${quota.remainingCredits}`,
				level: "normal"
			};
			return {
				text: "—",
				tooltip: "WorkBuddy quota unavailable — click to refresh",
				level: "normal"
			};
		}
		function WorkBuddyComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: "workbuddy-subscription",
				readStatus: (refresh) => refresh ? api.post("/quota") : api.get("/status"),
				selectFacts: selectBadgeFacts$2,
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/workbuddy/styles.ts
		const STYLE_ID$2 = "dsh-workbuddy-settings-style";
		/**
		* WorkBuddy-only additions to the shared settings design system.
		*
		* The base control styles (`.dsha-page`, `.dsha-group`, `.dsha-models`, the
		* account card, …) come from the stylesheet the sibling routes install, in the
		* same order the client installs them, so this file declares only what stays
		* unique to this card: the mono credential paths and the login-progress line.
		*
		* Everything this tab used to declare locally — the per-model capability line
		* and the account-region headings — is gone: the model pill is name-only like
		* every sibling tab, and the account card is the shared one.
		*/
		function installWorkBuddyStyles() {
			installPluginStyle("workbuddy", `
.dshwb-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}
.dsha-account-add-actions{display:flex;flex-wrap:wrap;gap:8px}
.dsha-account-add-actions .dsha-btn{background:var(--dsw-alias-button-info-fill,#397ee8);border-color:transparent;color:var(--dsw-alias-button-info-label,#fff)}
.dsha-account-add-actions .dsha-btn:hover:not(:disabled){opacity:.9;background:var(--dsw-alias-button-info-fill,#397ee8)}
/* Guardrails: one field per line, label left and control right — the same
   rhythm the context-window rows use, without a divider per row. Deliberately
   NOT .dsha-pref-row (a 58px full-width row with a border under it). */
.dshwb-fields{display:grid;gap:10px;margin:10px 0 14px}
.dshwb-field{align-items:center;display:flex;font-size:12px;gap:12px;justify-content:space-between}
.dshwb-control{align-items:center;display:flex;gap:8px}
.dshwb-control input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;padding:7px 9px;width:120px;text-align:right;box-sizing:border-box}
.dshwb-control input:disabled{opacity:.5}
.dshwb-control small{color:var(--dsw-alias-label-tertiary);font-size:11px;width:52px;text-align:left}
/* One control row: a flexible input with its actions beside it, never wrapped
   into two ragged lines. */
.dshwb-inputrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
.dshwb-inputrow>input{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:7px 9px;flex:1 1 260px;min-width:220px;max-width:420px;box-sizing:border-box}
.dshwb-inputrow>input:disabled{opacity:.5}
/* 自制渠道总入口：一行说明 + provider chip，下面把 WorkBuddy 与 Vertex 明确分区。 */
.dshwb-stack{box-sizing:border-box;display:flex;flex-direction:column;gap:28px;max-width:780px;min-width:0;padding:2px 0 30px}
.dshwb-hub{box-sizing:border-box;display:flex;flex-direction:column;gap:22px;max-width:780px;min-width:0}
.dshwb-hub-bar{align-items:center;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap;gap:8px 12px;justify-content:space-between;padding:0 0 12px}
.dshwb-hub-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:0}
.dshwb-hub-chip{background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.4;padding:3px 9px;white-space:nowrap}
.dshwb-zone{display:flex;flex-direction:column;gap:12px;min-width:0}
.dshwb-zone-head{align-items:baseline;border-bottom:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap;gap:4px 10px;padding-bottom:8px}
.dshwb-zone-tag{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:650}
.dshwb-zone-desc{color:var(--dsw-alias-label-tertiary);font-size:12px}
/* Vertex 导入状态指示：已连接 / 未导入 */
.dshwb-status{align-items:center;display:flex;font-size:12px;font-weight:600;gap:7px;margin:10px 0 0}
.dshwb-status::before{background:currentColor;border-radius:50%;content:"";height:7px;opacity:.6;width:7px}
.dshwb-status.is-on{color:var(--dsw-alias-label-success,#2f9e63)}
.dshwb-status.is-off{color:var(--dsw-alias-label-tertiary)}

`, STYLE_ID$2);
		}
		//#endregion
		//#region src/client/glm-coding-plan/GlmCodingPlanComposerQuota.tsx
		/**
		* 胶囊显示「最紧的那个窗口」的剩余百分比。
		*
		* 三个窗口（5 小时 / 1 周 / 1 月）互相独立地重置，用户当下真正被卡住的是**已用比例
		* 最高**的那一个：另外两个可能还剩一大半。所以这里不平均、不取最小剩余，而是取最大
		* 已用；已用相等时取更短的窗口——重置更早的那个才是当下的瓶颈。
		*
		* 窗口名不硬编码：键映射成窗口长度后交给共享的 quotaWindowLabel 本地化
		* （5 小时 / 1 周 / 1 月 / 5 hours / 1 week / 1 month）。
		*
		* 没有快照、没有窗口、或全部窗口都没有百分比时返回 null，即**不渲染胶囊**：
		* 契约允许 quota 为 null，装一个占位数字比不显示更像坏了。
		*/
		function selectBadgeFacts$1(status, lookup = (key) => zh$5[key]) {
			const measured = (status?.quota?.windows ?? []).filter((window) => typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent));
			if (measured.length === 0) return null;
			const tightest = measured.reduce((best, window) => {
				const bestMinutes = QUOTA_WINDOW_MINUTES$1[best.key];
				const minutes = QUOTA_WINDOW_MINUTES$1[window.key];
				if ((window.usedPercent ?? 0) > (best.usedPercent ?? 0)) return window;
				if ((window.usedPercent ?? 0) < (best.usedPercent ?? 0)) return best;
				return minutes < bestMinutes ? window : best;
			});
			const used = Math.max(0, Math.min(100, tightest.usedPercent ?? 0));
			const remaining = Math.round(100 - used);
			const label = quotaWindowLabel({
				label: "",
				usedPercent: used,
				windowDurationMins: QUOTA_WINDOW_MINUTES$1[tightest.key]
			}, {
				...accountPoolZh,
				quotaWindow: lookup("quotaWindow")
			});
			return {
				text: `${remaining}%`,
				tooltip: `[${lookup("title")}] ${label}: ${remaining}% ${lookup("composerLabel")}`,
				level: quotaLevel(remaining)
			};
		}
		function GlmCodingPlanComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: GLM_CODING_PLAN_PROVIDER_ID,
				readStatus: (refresh) => refresh ? post$2("/quota", {}) : get$1("/status"),
				selectFacts: (status) => selectBadgeFacts$1(status, t),
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/glm-coding-plan/styles.ts
		const STYLE_ID$1 = "dsh-glm-coding-plan-settings-style";
		/**
		* GLM（ZCode 账号）卡片独有的样式。
		*
		* 共享样式一律不重复声明：模型清单（.dsh-mcl-*）由 common/model-checklist-styles.ts
		* 负责，账号卡与配额条（.dsha-account-*）由 common/styles.ts 负责，基础控件
		* （.dsha-page / .dsha-group / .dsha-row / 胶囊等）由兄弟线路的安装器负责。
		* 本文件只声明没有兄弟线路共用过的东西：登录流程块、兜底入口行与手工粘贴面板、
		* 等宽文本、模型行右侧的窗口数字，以及「导入的登录态」徽标。
		*
		* 两区登录入口复用的 .dsha-account-add-actions 由 workbuddy/styles.ts 声明；
		* Claude 卡片同样直接用它而不在自己文件里重复声明，本卡沿用同一做法。
		*/
		function installGlmCodingPlanStyles() {
			installPluginStyle("glm-coding-plan", `
/* 登录流程块是**临时内容**：idle 时整块不渲染，因此它是一条顶部分隔线加间距，
   不再有底边——下面紧接着就是兜底入口行，两条线会把中间那一段夹成夹心。 */
.dshglm-flow{border-top:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:10px;margin-top:12px;padding-top:12px}
.dshglm-flow-url{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere;padding:8px 10px;user-select:all}
/* 兜底入口行：闲置时只有一行——idle 说明占左侧剩余宽度，手工粘贴开关在右侧。
   展开的面板用 flex-basis:100% 折到下一行占满整宽，所以窄屏回落是自然换行，
   不需要额外的媒体查询（写法与共享 .dsha-account-add-actions 同一套节奏）。 */
.dshglm-paste{align-items:center;display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.dshglm-paste-note{flex:1 1 260px;font-size:12px;min-width:0}
.dshglm-paste-body{display:flex;flex:1 1 100%;flex-direction:column;gap:8px}
.dshglm-paste-row{align-items:center;display:flex;flex-wrap:wrap;gap:8px}
.dshglm-paste-row input{flex:1 1 260px;min-width:200px}
.dshglm-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere}
.dshglm-model-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:5px}
.dsha-badge.glm-adopted{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 16%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
`, STYLE_ID$1);
		}
		//#endregion
		//#region src/client/step-code/StepCodeComposerQuota.tsx
		/**
		* 胶囊显示「最紧的那个老式窗口」的剩余百分比。
		*
		* 两个窗口（5 小时 / 周）互相独立地重置，用户当下真正被卡住的是**已用比例最高**的
		* 那一个：另外那个可能还剩一大半。所以这里不平均、不取最小剩余，而是取最大已用；
		* 已用相等时取更短的窗口——重置更早的那个才是当下的瓶颈。
		*
		* 窗口名不硬编码：键映射成窗口长度后交给共享的 quotaWindowLabel 本地化
		* （5 小时 / 1 周 / 5 hours / 1 week）。
		*
		* 没有快照、没有窗口、或全部窗口都没有百分比时返回 null（见文件头）。
		*/
		function selectBadgeFacts(status, lookup = (key) => zh$2[key]) {
			const quota = status?.quota;
			if (quota === null || quota === void 0) return null;
			if (quota.kind !== "windowed") return null;
			const measured = quota.windows.filter((window) => typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent));
			if (measured.length === 0) return null;
			const tightest = measured.reduce((best, window) => {
				const bestMinutes = QUOTA_WINDOW_MINUTES[best.key];
				const minutes = QUOTA_WINDOW_MINUTES[window.key];
				if ((window.usedPercent ?? 0) > (best.usedPercent ?? 0)) return window;
				if ((window.usedPercent ?? 0) < (best.usedPercent ?? 0)) return best;
				return minutes < bestMinutes ? window : best;
			});
			const used = Math.max(0, Math.min(100, tightest.usedPercent ?? 0));
			const remaining = Math.round(100 - used);
			const label = quotaWindowLabel({
				label: "",
				usedPercent: used,
				windowDurationMins: QUOTA_WINDOW_MINUTES[tightest.key]
			}, {
				...accountPoolZh,
				quotaWindow: lookup("quotaWindow")
			});
			return {
				text: `${remaining}%`,
				tooltip: `[${lookup("title")}] ${label}: ${remaining}% ${lookup("composerLabel")}`,
				level: quotaLevel(remaining)
			};
		}
		/**
		* 输入框右侧的额度胶囊本体。
		*
		* **槽位号由波次 4 注册，本文件不注册任何槽位**：conversation.input.right 现有
		* 35–42（codex → antigravity → command-code → kimi-code → workbuddy → minimax-code →
		* claude → glm-coding-plan），本线路取下一个号 43，id 沿用命名习惯
		* 'step-code-quota'，locale 为 NS_STEP_CODE。顺延而不是插号：给新线路重排既有号会让
		* 已上线线路的槽位位置无谓地变一次。
		*/
		function StepCodeComposerQuota({ directory, loadModelDirectory, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerQuotaBadge, {
				directory,
				loadModelDirectory,
				providerId: STEP_CODE_PROVIDER_ID,
				readStatus: (refresh) => refresh ? post("/quota", {}) : get("/status"),
				selectFacts: (status) => selectBadgeFacts(status, t),
				label: t("composerLabel")
			});
		}
		//#endregion
		//#region src/client/step-code/styles.ts
		const STYLE_ID = "dsh-step-code-settings-style";
		/**
		* Step Code（Step Plan 订阅）卡片独有的样式。
		*
		* 共享样式一律不重复声明：模型清单（.dsh-mcl-*）由 common/model-checklist-styles.ts
		* 负责，账号卡与其配额条（.dsha-account-*）由 common/styles.ts 负责，基础控件
		* （.dsha-page / .dsha-group / .dsha-row / 计量条 .dsha-meter-* 等）由兄弟线路的安装器
		* 负责；本卡直接用它们，不在这里再写一遍。.dsha-account-add-actions 同样沿用
		* workbuddy/styles.ts 的那份声明。
		*
		* 本文件只声明三样别处没有的东西：
		*
		*   1. 本线路自己的登录相关块：登录流程块（临时内容）、兜底入口行与手工粘贴面板、
		*      等宽文本、模型行右侧的窗口数字；
		*   2. **线路级额度**的形状：老式窗口与 Credit 桶各有各的行与条，以及快照卡里那几行
		*      事实用的紧凑网格（.dshsc-fact-grid）。账号卡里的 .dsha-account-quota-* 是共享
		*      组件的，不在这里重复；
		*   3. 两处版面纪律所需的类：**补充说明的折叠区**（.dshsc-details）与**额度凭据的输入
		*      网格**（.dshsc-cred-grid）。网格窄屏回落成单列，媒体查询照抄 common/styles.ts
		*      里 max-width:560px 的现成写法。
		*
		* 折叠区不删信息：每一句说明仍然在 DOM 与 textContent 里，只是默认不占版面；正文因此
		* 只留「标题 → 一句话 → 控件 → 折叠的补充说明」。
		*
		* 前缀统一 .dshsc-（Step Code），不与任何兄弟线路的选择器相撞。
		*/
		function installStepCodeStyles() {
			installPluginStyle("step-code", `
/* 登录流程块是**临时内容**：idle 时整块不渲染，因此它是一条顶部分隔线加间距，
   不再有底边——下面紧接着就是兜底入口行，两条线会把中间那一段夹成夹心。 */
.dshsc-flow{border-top:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:10px;margin-top:12px;padding-top:12px}
.dshsc-flow-url{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere;padding:8px 10px;user-select:all}
/* 兜底入口行：闲置时只有一行——idle 说明占左侧剩余宽度，手工粘贴开关在右侧。
   展开的面板用 flex-basis:100% 折到下一行占满整宽，所以窄屏回落是自然换行，
   不需要额外的媒体查询（与 GLM 卡同一套写法）。 */
.dshsc-paste{align-items:center;display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.dshsc-paste-note{flex:1 1 260px;font-size:12px;min-width:0}
.dshsc-paste-body{display:flex;flex:1 1 100%;flex-direction:column;gap:8px}
.dshsc-paste-row{align-items:center;display:flex;flex-wrap:wrap;gap:8px}
.dshsc-paste-row input{flex:1 1 260px;min-width:200px}
.dshsc-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;overflow-wrap:anywhere}
.dshsc-model-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:5px}
.dshsc-quota-list{display:flex;flex-direction:column;gap:9px;margin-top:12px}
.dshsc-quota-row{align-items:center;display:flex;flex-wrap:wrap;gap:8px}
.dshsc-quota-name{color:var(--dsw-alias-label-primary);font-size:12px;min-width:104px}
.dshsc-quota-track{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.15));border-radius:999px;height:7px;overflow:hidden;width:100%}
.dshsc-quota-track>span{background:var(--dsw-alias-button-info-fill,#397ee8);border-radius:inherit;display:block;height:100%;max-width:100%;min-width:0;transition:width .25s ease}
.dshsc-quota-row[data-level='warning'] .dshsc-quota-track>span{background:var(--dsw-alias-label-warning,#f59e0b)}
.dshsc-quota-row[data-level='danger'] .dshsc-quota-track>span{background:var(--dsw-alias-label-danger,#ef4444)}
.dshsc-quota-value{color:var(--dsw-alias-label-secondary);font-size:12px}
.dshsc-quota-meta{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dshsc-bucket{border-top:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap;gap:8px;padding-top:9px}
/* 快照卡里的几行事实：紧凑网格，一格一件事，行高一致。
   auto-fit + minmax 是为了窄屏自动折列，而不是让一行一个标签占满整宽。 */
.dshsc-fact-grid{display:grid;gap:9px 20px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:11px}
.dshsc-fact{display:flex;flex-direction:column;gap:3px;min-width:0}
.dshsc-fact>span:first-child{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4}
.dshsc-fact>span:last-child{color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.4}

/* 补充说明的折叠区：原句一个不少，只是默认收起。 */
.dshsc-details{border-top:0.5px solid var(--dsw-alias-border-l2);padding:10px 0 2px}
.dshsc-details>summary{color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;line-height:1.5;list-style:none;user-select:none}
.dshsc-details>summary::-webkit-details-marker{display:none}
.dshsc-details[open]>summary{color:var(--dsw-alias-label-primary)}
.dshsc-details>p{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55;margin:9px 0 0}

/* 额度凭据：两个获取方式各一个子块，输入行是网格而不是可换行的 flex 行——
   flex-wrap 会让按钮在窄屏单独掉到下一行且与输入框错位，网格保证等高、同一基线。 */
.dshsc-cred-block{border-top:0.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:8px;padding:13px 0}
.dshsc-cred-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.35}
.dshsc-cred-grid{align-items:center;display:grid;gap:8px;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}
.dshsc-cred-grid-narrow{grid-template-columns:minmax(0,1fr) auto}
.dshsc-cred-grid>input{max-width:none;min-width:0;width:100%}
/* 窄屏回落：写法与 common/styles.ts:34 里的 max-width:560px 媒体查询一致。
   凭据网格折成单列；兜底入口行不需要媒体查询——它本来就是可换行的 flex 行。 */
@media(max-width:560px){.dshsc-cred-grid,.dshsc-cred-grid-narrow{grid-template-columns:minmax(0,1fr)}}

.dsha-badge.dshsc-adopted{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 16%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#397ee8) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
`, STYLE_ID);
		}
		//#endregion
		//#region src/client/mermaid/sanitize.ts
		const STRIP_ELEMENTS = /* @__PURE__ */ new Set([
			"foreignobject",
			"script",
			"img",
			"iframe",
			"object",
			"embed",
			"video",
			"audio",
			"input",
			"button",
			"form",
			"link",
			"meta",
			"base"
		]);
		function sanitizeSvg(svg) {
			if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return "";
			let doc;
			try {
				doc = new DOMParser().parseFromString(svg, "image/svg+xml");
			} catch {
				return "";
			}
			if (doc.querySelector("parsererror") !== null) return "";
			if (doc.documentElement === null || doc.documentElement.localName !== "svg") return "";
			doc.querySelectorAll("*").forEach((node) => {
				if (STRIP_ELEMENTS.has(node.localName.toLowerCase())) {
					node.remove();
					return;
				}
				for (const attribute of [...node.attributes]) {
					const name = attribute.name;
					const normalized = name.toLowerCase();
					if (normalized.startsWith("@") || normalized.startsWith("on")) {
						node.removeAttribute(name);
						continue;
					}
					if (normalized === "href" || normalized === "xlink:href") node.removeAttribute(name);
				}
			});
			return new XMLSerializer().serializeToString(doc.documentElement);
		}
		//#endregion
		//#region src/client/mermaid/styles.ts
		const MERMAID_STYLE_ID = "dsh-mermaid-renderer-style";
		function installMermaidStyles() {
			installPluginStyle("mermaid", `
.dsh-mermaid-wrapper{margin:12px 0;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.12));border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#1a1a1a);box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.dsh-mermaid-header{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,0.25));border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.08));font-size:12px;color:var(--dsw-alias-label-secondary,#888)}
.dsh-mermaid-title{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--dsw-alias-label-tertiary,#aaa);font-weight:600}
.dsh-mermaid-controls{display:flex;gap:8px;align-items:center}
.dsh-mermaid-btn{background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.15));border-radius:4px;color:var(--dsw-alias-label-secondary,#ccc);padding:2px 8px;font-size:11px;cursor:pointer;line-height:18px;transition:all .15s}
.dsh-mermaid-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.08));color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-border-l1,rgba(255,255,255,0.3))}
.dsh-mermaid-chart{padding:18px;overflow-x:auto;display:flex;justify-content:center;align-items:center;min-height:100px;background:var(--dsw-alias-bg-layer-2,#181818);cursor:zoom-in}
.dsh-mermaid-chart svg{max-width:100%;height:auto;display:block;margin:0 auto}
.dsh-mermaid-source{display:none;margin:0;padding:12px;background:var(--dsw-alias-bg-layer-1,#121212);border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.08));font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.dsh-mermaid-source.is-visible{display:block}

/* 全屏缩放预览模态框 */
.dsh-mermaid-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:center;align-items:center}
.dsh-mermaid-modal-toolbar{position:absolute;top:20px;right:24px;display:flex;gap:8px;background:rgba(20,20,20,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5)}
.dsh-mermaid-modal-btn{background:transparent;border:0;color:#fff;font-size:14px;padding:6px 12px;cursor:pointer;border-radius:4px}
.dsh-mermaid-modal-btn:hover{background:rgba(255,255,255,0.15)}
.dsh-mermaid-modal-stage{flex:1;width:100%;height:100%;overflow:auto;display:flex;justify-content:center;align-items:center;padding:40px}
.dsh-mermaid-modal-stage svg{max-width:90vw;max-height:85vh;height:auto}
`, MERMAID_STYLE_ID);
		}
		//#endregion
		//#region src/client/mermaid/renderer.ts
		let mermaidSeq = 0;
		let mermaidPromise = null;
		const processedHosts = /* @__PURE__ */ new WeakSet();
		function loadMermaid() {
			if (typeof window === "undefined") return Promise.resolve(null);
			const existing = window.mermaid;
			if (existing) return Promise.resolve(existing);
			if (mermaidPromise) return mermaidPromise;
			mermaidPromise = new Promise((resolve) => {
				const current = window.mermaid;
				if (current) {
					resolve(current);
					return;
				}
				const script = document.createElement("script");
				script.src = "/wb/api/dsh-chatgpt-subscription/mermaid.min.js";
				script.async = true;
				script.onload = () => {
					resolve(window.mermaid || null);
				};
				script.onerror = () => {
					const cdn = document.createElement("script");
					cdn.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
					cdn.async = true;
					cdn.onload = () => resolve(window.mermaid || null);
					cdn.onerror = () => resolve(null);
					document.head.appendChild(cdn);
				};
				document.head.appendChild(script);
			});
			return mermaidPromise;
		}
		function isDarkTheme() {
			if (typeof document === "undefined") return false;
			const root = document.documentElement;
			return root.classList.contains("dark") || root.getAttribute("data-theme") === "dark" || root.getAttribute("data-color-mode") === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches;
		}
		async function initMermaidConfig() {
			const m = await loadMermaid();
			if (!m) return null;
			try {
				m.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					htmlLabels: false,
					theme: isDarkTheme() ? "dark" : "default",
					fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
				});
			} catch {}
			return m;
		}
		function openZoomModal(svgHtml) {
			const overlay = document.createElement("div");
			overlay.className = "dsh-mermaid-modal-overlay";
			let scale = 1;
			overlay.innerHTML = `
    <div class="dsh-mermaid-modal-toolbar">
      <button type="button" class="dsh-mermaid-modal-btn" data-action="zoom-out" title="缩小">− 缩小</button>
      <button type="button" class="dsh-mermaid-modal-btn" data-action="zoom-in" title="放大">+ 放大</button>
      <button type="button" class="dsh-mermaid-modal-btn" data-action="reset" title="重置">⟳ 重置</button>
      <button type="button" class="dsh-mermaid-modal-btn" data-action="close" title="关闭">关闭</button>
    </div>
    <div class="dsh-mermaid-modal-stage">
      <div class="dsh-mermaid-zoom-container">${svgHtml}</div>
    </div>
  `;
			const stage = overlay.querySelector(".dsh-mermaid-zoom-container");
			const updateTransform = () => {
				if (stage) stage.style.transform = `scale(${scale})`;
			};
			overlay.addEventListener("click", (e) => {
				const target = e.target;
				const action = target?.getAttribute("data-action");
				if (action === "close" || target === overlay) {
					overlay.remove();
					document.removeEventListener("keydown", onKeyDown);
				} else if (action === "zoom-in") {
					scale = Math.min(5, scale * 1.25);
					updateTransform();
				} else if (action === "zoom-out") {
					scale = Math.max(.2, scale / 1.25);
					updateTransform();
				} else if (action === "reset") {
					scale = 1;
					updateTransform();
				}
			});
			const onKeyDown = (e) => {
				if (e.key === "Escape") {
					overlay.remove();
					document.removeEventListener("keydown", onKeyDown);
				}
			};
			document.addEventListener("keydown", onKeyDown);
			document.body.appendChild(overlay);
		}
		function findMermaidCandidate(codeEl) {
			if (codeEl.closest(".dsh-mermaid-wrapper")) return null;
			const host = codeEl.closest(".md-code-block") || codeEl.closest("pre") || codeEl;
			if (processedHosts.has(host) || host.getAttribute("data-dsh-mermaid-status")) return null;
			if (host.previousElementSibling?.classList.contains("dsh-mermaid-wrapper")) return null;
			const codeText = (codeEl.textContent || "").trim();
			if (!codeText || codeText.length < 5) return null;
			const hasMermaidClass = [...codeEl.classList].some((c) => c.toLowerCase().includes("mermaid"));
			const topText = host.firstElementChild?.textContent?.trim().toLowerCase();
			const isHeaderMermaid = topText === "mermaid" || topText?.startsWith("mermaid ");
			const isGrammarStart = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/i.test(codeText);
			if (hasMermaidClass || isHeaderMermaid || isGrammarStart) return {
				host,
				code: codeText
			};
			return null;
		}
		async function renderMermaidHost(host, code) {
			processedHosts.add(host);
			host.setAttribute("data-dsh-mermaid-status", "processing");
			const m = await initMermaidConfig();
			if (!m) {
				processedHosts.delete(host);
				host.removeAttribute("data-dsh-mermaid-status");
				return;
			}
			const renderId = `dsh-mermaid-${++mermaidSeq}`;
			try {
				const { svg } = await m.render(renderId, code);
				const cleanSvg = sanitizeSvg(svg);
				if (!cleanSvg) {
					processedHosts.delete(host);
					host.removeAttribute("data-dsh-mermaid-status");
					return;
				}
				if (host.previousElementSibling?.classList.contains("dsh-mermaid-wrapper")) {
					host.setAttribute("data-dsh-mermaid-status", "done");
					host.style.display = "none";
					return;
				}
				const wrapper = document.createElement("div");
				wrapper.className = "dsh-mermaid-wrapper";
				let showSource = false;
				wrapper.innerHTML = `
      <div class="dsh-mermaid-header">
        <span class="dsh-mermaid-title">Mermaid 图表</span>
        <div class="dsh-mermaid-controls">
          <button type="button" class="dsh-mermaid-btn" data-btn="toggle-source">源码</button>
          <button type="button" class="dsh-mermaid-btn" data-btn="copy">复制</button>
          <button type="button" class="dsh-mermaid-btn" data-btn="zoom" title="放大查看">放大 ↗</button>
        </div>
      </div>
      <div class="dsh-mermaid-chart" title="点击放大">${cleanSvg}</div>
      <div class="dsh-mermaid-source"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></div>
    `;
				const sourceEl = wrapper.querySelector(".dsh-mermaid-source");
				const toggleBtn = wrapper.querySelector("[data-btn=\"toggle-source\"]");
				const copyBtn = wrapper.querySelector("[data-btn=\"copy\"]");
				const chartEl = wrapper.querySelector(".dsh-mermaid-chart");
				toggleBtn?.addEventListener("click", (e) => {
					e.stopPropagation();
					showSource = !showSource;
					if (showSource) {
						sourceEl.classList.add("is-visible");
						toggleBtn.textContent = "图表";
					} else {
						sourceEl.classList.remove("is-visible");
						toggleBtn.textContent = "源码";
					}
				});
				copyBtn?.addEventListener("click", async (e) => {
					e.stopPropagation();
					try {
						await navigator.clipboard.writeText(code);
						copyBtn.textContent = "已复制";
						setTimeout(() => {
							copyBtn.textContent = "复制";
						}, 1500);
					} catch {}
				});
				const handleZoom = (e) => {
					e.stopPropagation();
					openZoomModal(cleanSvg);
				};
				wrapper.querySelector("[data-btn=\"zoom\"]")?.addEventListener("click", handleZoom);
				chartEl?.addEventListener("click", handleZoom);
				host.style.display = "none";
				host.parentNode?.insertBefore(wrapper, host);
				host.setAttribute("data-dsh-mermaid-status", "done");
			} catch {
				processedHosts.delete(host);
				host.removeAttribute("data-dsh-mermaid-status");
				const errContainer = document.getElementById(renderId);
				if (errContainer) errContainer.remove();
			}
		}
		function scanAndRenderMermaid() {
			if (typeof document === "undefined") return;
			const codeElements = document.querySelectorAll("pre code, .md-code-block code");
			for (const codeEl of codeElements) {
				const candidate = findMermaidCandidate(codeEl);
				if (candidate) renderMermaidHost(candidate.host, candidate.code);
			}
		}
		function setupMermaidObserver() {
			if (typeof document === "undefined") return () => {};
			installMermaidStyles();
			let timer;
			const debouncedScan = () => {
				window.clearTimeout(timer);
				timer = window.setTimeout(() => {
					scanAndRenderMermaid();
				}, 250);
			};
			debouncedScan();
			const observer = new MutationObserver((mutations) => {
				let shouldScan = false;
				for (const m of mutations) {
					for (const node of m.addedNodes) if (node.nodeType === 1) {
						const el = node;
						if (el.classList?.contains("dsh-mermaid-wrapper") || el.closest?.(".dsh-mermaid-wrapper")) continue;
						shouldScan = true;
						break;
					}
					if (shouldScan) break;
				}
				if (shouldScan) debouncedScan();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			const themeObserver = new MutationObserver(() => {
				initMermaidConfig();
				for (const el of document.querySelectorAll("[data-dsh-mermaid-status=\"done\"]")) {
					processedHosts.delete(el);
					el.removeAttribute("data-dsh-mermaid-status");
					const prevWrapper = el.previousElementSibling;
					if (prevWrapper && prevWrapper.classList.contains("dsh-mermaid-wrapper")) prevWrapper.remove();
					el.style.display = "";
				}
				debouncedScan();
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: [
					"class",
					"data-theme",
					"data-color-mode"
				]
			});
			return () => {
				observer.disconnect();
				themeObserver.disconnect();
				window.clearTimeout(timer);
			};
		}
		//#endregion
		//#region src/client/workbuddy/VertexSection.tsx
		/**
		* The WorkBuddy card's Vertex AI service-account import.
		*
		* Vertex is Google Cloud pay-as-you-go, NOT WorkBuddy subscription quota —
		* the copy here says so, because a user who imports an account is billed by
		* Google and spends none of the subscription allowance.
		*
		* Privacy: the service-account JSON carries a private key. It is read
		* straight out of the picked file into component memory, POSTed once, then
		* dropped; it never touches localStorage, is never logged and is never
		* rendered. The status route answers identity only
		* (`{configured,project,clientEmail,location,models}`).
		*
		* Its own route namespace: the Host mounts Vertex apart from
		* `/wb/workbuddy/api`, and this card degrades to a notice when that half is not
		* loaded yet rather than failing the whole WorkBuddy card.
		*/
		const VERTEX_API = "/wb/workbuddy/vertex/api";
		const vertexApi = createLineApi(VERTEX_API, "Vertex");
		const VERTEX_LOCATION = "global";
		function VertexSection({ onModelChange, loadModelDirectory }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [unreachable, setUnreachable] = (0, react.useState)(false);
			const [testResult, setTestResult] = (0, react.useState)(null);
			const [pathDraft, setPathDraft] = (0, react.useState)("");
			const fileInput = (0, react.useRef)(null);
			/** Set the instant an import begins so a second selection cannot double-submit. */
			const importingRef = (0, react.useRef)(false);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					setStatus((await vertexApi.request("/status")) ?? null);
					setUnreachable(false);
				} catch (err) {
					setUnreachable(true);
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				void loadStatus();
			}, [loadStatus]);
			/** Submit one payload ({json} or {filePath}); the caller owns clearing its copy. */
			const submit = async (body) => {
				if (importingRef.current) return false;
				importingRef.current = true;
				try {
					setBusy("import");
					setError(null);
					setNotice(null);
					setTestResult(null);
					await vertexApi.request("/import", {
						method: "POST",
						body: JSON.stringify({
							...body,
							location: VERTEX_LOCATION
						})
					});
					await loadStatus(true);
					setNotice("导入成功。Vertex 由 Google Cloud 按量计费，不属于 WorkBuddy 订阅额度；请刷新模型列表以获取 Vertex 模型。");
					onModelChange?.();
					loadModelDirectory?.();
					return true;
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					return false;
				} finally {
					importingRef.current = false;
					setBusy(null);
				}
			};
			const importFromFile = async (file) => {
				// Enter busy before reading so the picker cannot fire a second import.
				if (importingRef.current) return;
				importingRef.current = true;
				setBusy("import");
				setError(null);
				setNotice(null);
				setTestResult(null);
				let text = "";
				try {
					text = await file.text();
				} catch {
					setError("读取所选文件失败。");
					importingRef.current = false;
					setBusy(null);
					return;
				}
				importingRef.current = false;
				let ok = false;
				try {
					ok = await submit({ json: text });
				} finally {
					// Sensitive JSON stays in memory only; cleared on success so a failed retry keeps it out of the UI.
					text = "";
				}
				return ok;
			};
			const runTest = async () => {
				try {
					setBusy("test");
					setError(null);
					setTestResult(null);
					const result = await vertexApi.request("/test", { method: "POST" });
					setTestResult(result?.message ?? "测试完成。");
					await loadStatus(true);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const runRefreshCatalog = async () => {
				try {
					setBusy("catalog");
					setError(null);
					setNotice(null);
					const refreshed = await vertexApi.request("/catalog/refresh", { method: "POST" });
					setStatus(refreshed ?? null);
					setNotice(`已从 Vertex Model Garden 同步最新模型目录（共 ${(refreshed?.models ?? []).length} 个模型）。`);
					onModelChange?.();
					loadModelDirectory?.();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(null);
				}
			};
			const configured = status?.configured === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dshwb-zone",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshwb-zone-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwb-zone-tag",
							children: "Vertex AI 服务账号"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwb-zone-desc",
							children: "Google Cloud 按量计费"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: "导入 Google Cloud 服务账号 JSON，让 Vertex 模型可在此路线使用。Vertex 是 Google Cloud 的按量计费，不消耗 WorkBuddy 订阅额度。"
					}),
					loading ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: `dshwb-status ${configured ? "is-on" : "is-off"}`,
						children: [configured ? "已导入服务账号" : "未导入服务账号", configured && status?.project ? ` · ${status.project}` : ""]
					}),
					unreachable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-notice",
						children: "Vertex 设置路由暂不可用（Host 可能尚未加载后端）。"
					}) : null,
					configured ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshwb-fields",
						children: [
							["项目", status?.project],
							["服务账号", status?.clientEmail],
							["位置", status?.location]
						].map(([label, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshwb-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshwb-mono",
								children: value ?? "—"
							})]
						}, label))
					}) : null,
					configured && Array.isArray(status?.models) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-muted",
						children: `模型：${status.models.join("、")}`
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsha-actions",
						style: { justifyContent: "flex-start" },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: fileInput,
								type: "file",
								accept: "application/json,.json",
								style: { display: "none" },
								onChange: (event) => {
									const file = event.currentTarget.files?.[0];
									event.currentTarget.value = "";
									if (file) void importFromFile(file);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn dsha-btn-primary",
								disabled: busy !== null,
								onClick: () => fileInput.current?.click(),
								children: busy === "import" ? "导入中…" : "选择 JSON 文件导入"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null || !configured,
								onClick: () => void runRefreshCatalog(),
								children: busy === "catalog" ? "刷新中…" : "刷新模型目录"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null || !configured,
								onClick: () => void runTest(),
								children: busy === "test" ? "测试中…" : "测试连接"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshwb-inputrow",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "或输入服务账号 JSON 的本地绝对路径，例如 C:\\keys\\sa.json",
								value: pathDraft,
								disabled: busy !== null,
								onChange: (event) => setPathDraft(event.currentTarget.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsha-btn",
								disabled: busy !== null || pathDraft.trim() === "",
								onClick: () => void (async () => {
									const ok = await submit({ filePath: pathDraft.trim() });
									// Keep the draft when the path failed so it can be corrected, not retyped.
									if (ok) setPathDraft("");
								})(),
								children: "按路径导入"
							})
						]
					}),
					notice ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-notice",
						children: notice
					}) : null,
					testResult ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-notice",
						children: testResult
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsha-notice",
						children: `Vertex：${error}`
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/aistudio/AiStudioSection.tsx
		/**
		* Google AI Studio 设置卡片：多 API Key 账号池 + 模型目录 + 上下文覆盖。
		*
		* 与 Antigravity / WorkBuddy / Vertex 三张卡片同一套共享组件：
		*   - 账号池：common/AccountPoolSection.tsx（这里以 API Key 代替 OAuth 登录）
		*   - 模型勾选：common/ModelChecklist.tsx
		*   - 上下文：common/ContextWindowEditor.tsx
		* 本文件只负责 AI Studio 自己的取数与写回，不新建任何 UI 组件。
		*/
		const AISTUDIO_API = "/wb/aistudio/api";
		const aiStudioApi = createLineApi(AISTUDIO_API, "Google AI Studio");
		const AISTUDIO_LOCALES = {
			...accountPoolZh,
			title: "Google AI Studio",
			accountPool: "API Key 账号池",
			addAccount: "添加 API Key",
			accountCount: "共 {count} 个 Key",
			primaryAccount: "主 Key",
			activeAccount: "当前使用",
			setPrimary: "设为主 Key",
			noAccounts: "还没有 API Key。点击「添加 API Key」，每行一个，可写成「备注=AIza...」批量导入。",
			needsRelogin: "Key 已失效",
			relogin: "重新添加",
			modelsSection: "模型",
			modelsHint: "勾选后模型才会出现在对话页的模型选择列表；勾选全部或关闭概览卡片开关可整体隐藏该渠道。",
			refreshCatalog: "刷新模型目录",
			refreshingCatalog: "刷新中…",
			selectAll: "全选",
			unselectAll: "全不选",
			enhanced: "增强功能",
			defaultReasoningEffort: "默认思考深度",
			defaultReasoningEffortHint: "Gemini 2.5 映射为思考预算，Gemini 3 映射为思考等级；留空则用模型自身默认行为。",
			defaultEffortAuto: "使用模型默认值",
			contextWindowSection: "模型上下文窗口",
			contextWindowHint: "默认按官方目录容量；可覆盖为更高或更低值，供 DSH 的压缩与溢出判断使用，支持 1M、512K、200K 等写法。",
			contextWindowReset: "恢复默认",
			contextWindowResetAll: "全部恢复默认",
			contextWindowResetAllConfirm: "确定把所有已改的模型上下文窗口恢复为默认值吗？",
			contextWindowNoneEnabled: "还没有勾选任何模型。在上方勾选后，这里会出现对应设置。",
			save: "保存",
			saved: "已保存",
			saving: "保存中…",
			tokens: "tokens",
			connection: "连接与网关",
			baseUrl: "接口地址",
			baseUrlHint: "默认官方 https://generativelanguage.googleapis.com；也可填 Gemini Balance、New-API 等反代网关的根地址。",
			test: "测试连接",
			testing: "测试中…",
			loading: "加载中…",
			tunnelSection: "WebSocket 隧道",
			tunnelHint: "开启后请求不在 DSH 进程里直接出网，而是交给浏览器页面执行 fetch：带上页面 Cookie、浏览器 TLS 指纹和它所在网络的出口 IP。云端服务器没有浏览器时，打开「内置无头浏览器」即可由插件自己养一个。",
			tunnelEnabled: "走隧道",
			tunnelBrowser: "内置无头浏览器",
			tunnelBrowserHint: "由插件在本机启动并保持一个无头 Chromium，24 小时跟随 DSH 运行；首次启动会自动下载（约 120MB）。",
			tunnelConnected: "已连接",
			tunnelDisconnected: "未连接",
			tunnelConnections: "连接数",
			tunnelClient: "客户端",
			tunnelPage: "页面",
			tunnelUrl: "接入地址",
			tunnelUrlHint: "给外部浏览器脚本用；连同令牌一起复制，别外传。",
			tunnelCopy: "复制",
			tunnelCopied: "已复制",
			tunnelRotate: "重置令牌",
			tunnelTest: "测试隧道",
			tunnelLogin: "打开登录窗口",
			tunnelLoginHint: "云端需要 Google 登录态时用：在有桌面的机器上点它，登录后关闭窗口即可，登录态会留在插件自己的 profile 里。",
			tunnelAgentStopped: "未启动",
			tunnelAgentStarting: "启动中…",
			tunnelAgentRunning: "运行中",
			tunnelAgentFailed: "启动失败",
			tunnelRequests: "已转发",
			tunnelBrowserName: "浏览器",
			off: "关闭",
			on: "开启"
		};
		/** 把一行 Key 掩码后展示，绝不渲染明文。 */
		function aiStudioKeyLabel(account) {
			return account.alias || account.maskedKey || account.id;
		}
		function AiStudioSection({ onModelChange, loadModelDirectory } = {}) {
			const t = AISTUDIO_LOCALES;
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [baseDraft, setBaseDraft] = (0, react.useState)("");
			const [contextDrafts, setContextDrafts] = (0, react.useState)({});
			const [savingModel, setSavingModel] = (0, react.useState)(null);
			const notifyChange = (0, react.useCallback)(() => {
				onModelChange?.();
				loadModelDirectory?.();
			}, [onModelChange, loadModelDirectory]);
			const applyStatus = (0, react.useCallback)((next) => {
				setStatus(next ?? null);
				setBaseDraft(next?.baseUrl ?? "");
				setContextDrafts(contextDraftsFor(next ?? { models: [], contextWindowOverrides: {} }));
			}, []);
			const loadStatus = (0, react.useCallback)(async (quiet = false) => {
				if (!quiet) setError(null);
				try {
					applyStatus(await aiStudioApi.request("/status"));
				} catch (err) {
					if (!quiet) setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [applyStatus]);
			(0, react.useEffect)(() => {
				void loadStatus();
			}, [loadStatus]);
			const run = async (label, fn) => {
				try {
					setBusy(label);
					setError(null);
					setNotice(null);
					const result = await fn();
					if (result !== void 0) applyStatus(result);
					notifyChange();
					return true;
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					return false;
				} finally {
					setBusy(null);
				}
			};
			const addKeys = () => run("keys", async () => {
				const updated = await aiStudioApi.request("/keys", { method: "POST", body: JSON.stringify({ text: keyDraft }) });
				setKeyDraft("");
				setNotice("API Key 已加密保存。");
				return updated;
			});
			const accountAction = (action, accountId) => run(`${action}-${accountId ?? ""}`, () => aiStudioApi.request("/accounts", {
				method: "POST", body: JSON.stringify({ action, accountId })
			}));
			const setStrategy = (strategy) => run(`strategy-${strategy}`, () => aiStudioApi.request("/accounts", {
				method: "POST", body: JSON.stringify({ action: "strategy", strategy })
			}));
			const [tunnelSecret, setTunnelSecret] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(false);
			const loadTunnelSecret = (0, react.useCallback)(async () => {
				try {
					setTunnelSecret(await aiStudioApi.request("/tunnel/secret"));
				} catch {
					setTunnelSecret(null);
				}
			}, []);
			(0, react.useEffect)(() => {
				if (status?.tunnel?.enabled) void loadTunnelSecret();
			}, [status?.tunnel?.enabled, loadTunnelSecret]);
			const tunnelAction = (patch) => run("tunnel", async () => {
				const updated = await aiStudioApi.request("/tunnel", { method: "POST", body: JSON.stringify(patch) });
				void loadTunnelSecret();
				return updated;
			});
			const copyTunnelUrl = () => {
				const text = tunnelSecret?.url ?? "";
				if (text === "") return;
				void navigator.clipboard?.writeText(text).then(() => {
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				}).catch(() => undefined);
			};
			const saveSettings = (patch) => run("settings", () => aiStudioApi.request("/settings", { method: "POST", body: JSON.stringify(patch) }));
			const toggleModel = (modelId, enabled) => run(`model-${modelId}`, () => {
				const current = status?.models?.filter(model => model.enabled).map(model => model.id) ?? [];
				const next = enabled ? [...new Set([...current, modelId])] : current.filter(id => id !== modelId);
				return aiStudioApi.request("/models", { method: "POST", body: JSON.stringify({ enabledModelIds: next }) });
			});
			const setAllModels = (selectAll) => run("models-all", () => aiStudioApi.request("/models", {
				method: "POST",
				body: JSON.stringify({ enabledModelIds: selectAll ? (status?.models ?? []).map(model => model.id) : [] })
			}));
			const saveContext = (modelId) => {
				const parsed = parsePositiveCapacity(contextDrafts[modelId] || "");
				if (parsed === null) {
					setError(`无效的上下文容量值: ${contextDrafts[modelId] || ""}`);
					return;
				}
				setSavingModel(modelId);
				void saveSettings({ contextWindowOverrides: { [modelId]: parsed } }).finally(() => setSavingModel(null));
			};
			const resetContext = (modelId) => {
				setSavingModel(modelId);
				void saveSettings({ contextWindowOverrides: { [modelId]: null } }).finally(() => setSavingModel(null));
			};
			const resetAllContext = () => {
				const ids = Object.keys(status?.contextWindowOverrides ?? {});
				if (ids.length === 0) return;
				if (typeof window !== "undefined" && !window.confirm(t.contextWindowResetAllConfirm)) return;
				void saveSettings({ contextWindowOverrides: Object.fromEntries(ids.map(id => [id, null])) });
			};
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsha-page", children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsha-empty", children: t.loading }) });
			const configured = status?.configured === true;
			const enabledModels = (status?.models ?? []).filter(model => model.enabled);
			const overrideCount = Object.keys(status?.contextWindowOverrides ?? {}).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsha-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: "接入 Google AI Studio（Gemini API）原生协议，支持多 API Key 轮询、429 自动换号与模型目录同步。Key 使用系统加密凭据存储，页面只显示掩码。" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AccountPoolSection, {
						accounts: status?.accounts ?? [],
						activeAccountId: status?.activeAccountId,
						rotationStrategy: status?.rotationStrategy ?? "sequential",
						labels: { ...t, accountCount: t.accountCount },
						busy,
						showQuota: false,
						onLogin: () => void addKeys(),
						loginBusyLabel: busy === "keys" ? "保存中…" : void 0,
						onSetPrimary: (accountId) => void accountAction("set-primary", accountId),
						onDelete: (accountId) => void accountAction("delete", accountId),
						onClearCooldown: (accountId) => void accountAction("clear-cooldown", accountId),
						onSetStrategy: (strategy) => void setStrategy(strategy),
						renderDetails: (account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsha-muted", children: `Key: ${aiStudioKeyLabel(account)}` }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshwb-inputrow",
							style: { flexDirection: "column", alignItems: "stretch", gap: 8 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									rows: 3,
									className: "dsha-select",
									placeholder: "每行一个 API Key，可写成「备注=AIza...」批量导入",
									value: keyDraft,
									disabled: busy !== null,
									onChange: (event) => setKeyDraft(event.currentTarget.value)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsha-actions",
									style: { justifyContent: "flex-start" },
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn dsha-btn-primary",
										disabled: busy !== null || keyDraft.trim() === "",
										onClick: () => void addKeys(),
										children: busy === "keys" ? "保存中…" : "添加 API Key"
									})
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsha-grouphead", children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.connection }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.baseUrl }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.baseUrlHint })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-actions",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "text",
												className: "dsha-select",
												style: { minWidth: 320 },
												placeholder: "https://generativelanguage.googleapis.com",
												value: baseDraft,
												disabled: busy !== null,
												onChange: (event) => setBaseDraft(event.currentTarget.value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-btn",
												disabled: busy !== null || baseDraft.trim() === "",
												onClick: () => void saveSettings({ baseUrl: baseDraft.trim() }),
												children: "保存地址"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsha-actions",
								style: { justifyContent: "flex-start" },
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dsha-btn",
									disabled: busy !== null || !configured,
									onClick: () => void run("test", async () => {
										const result = await aiStudioApi.request("/test", { method: "POST" });
										setNotice(result?.message ?? "测试通过。");
									}),
									children: busy === "test" ? t.testing : t.test
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.tunnelSection }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dsha-badge ${status?.tunnel?.connected ? "active" : ""}`,
										children: status?.tunnel?.connected ? `${t.tunnelConnected} · ${status.tunnel.connections}` : t.tunnelDisconnected
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.tunnelHint }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.tunnelEnabled }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: status?.tunnel?.connected ? `${t.tunnelPage}: ${status.tunnel.client?.href || "-"}` : t.tunnelHint })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsha-actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: `dsha-btn ${status?.tunnel?.enabled ? "dsha-btn-primary" : ""}`,
											disabled: busy !== null,
											onClick: () => void tunnelAction({ enabled: !status?.tunnel?.enabled }),
											children: busy === "tunnel" ? t.saving : status?.tunnel?.enabled ? t.on : t.off
										})
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.tunnelBrowser }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.tunnelBrowserHint })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-actions",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsha-muted",
												children: (() => {
													const agent = status?.tunnel?.agent ?? {};
													const label = agent.state === "running" ? t.tunnelAgentRunning : agent.state === "starting" ? t.tunnelAgentStarting : agent.state === "failed" ? t.tunnelAgentFailed : t.tunnelAgentStopped;
													const extra = agent.state === "running" ? ` · ${agent.browser ?? ""} · ${t.tunnelRequests} ${agent.requests ?? 0}` : agent.error ? ` · ${agent.error}` : "";
													return `${label}${extra}`;
												})()
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: `dsha-btn ${status?.tunnel?.browser ? "dsha-btn-primary" : ""}`,
												disabled: busy !== null,
												onClick: () => void tunnelAction({ browser: !status?.tunnel?.browser }),
												children: busy === "tunnel" ? t.saving : status?.tunnel?.browser ? t.on : t.off
											})
										]
									})
								]
							}),
							status?.tunnel?.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.tunnelUrl }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.tunnelUrlHint })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsha-actions",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "text",
												className: "dsha-select",
												style: { minWidth: 320 },
												readOnly: true,
												value: tunnelSecret?.url ?? ""
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-btn",
												onClick: copyTunnelUrl,
												children: copied ? t.tunnelCopied : t.tunnelCopy
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "dsha-btn",
												disabled: busy !== null,
												onClick: () => void tunnelAction({ rotateToken: true }),
												children: t.tunnelRotate
											})
										]
									})
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-actions",
								style: { justifyContent: "flex-start" },
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null || !status?.tunnel?.enabled,
										onClick: () => void run("tunnel-test", async () => {
											const result = await aiStudioApi.request("/tunnel/test", { method: "POST" });
											setNotice(result?.message ?? "隧道连通。");
										}),
										children: busy === "tunnel-test" ? t.testing : t.tunnelTest
									}),
									status?.tunnel?.browser ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null,
										onClick: () => void run("tunnel-login", async () => {
											await aiStudioApi.request("/tunnel/login", { method: "POST" });
											setNotice(t.tunnelLoginHint);
										}),
										children: busy === "tunnel-login" ? t.saving : t.tunnelLogin
									}) : null
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-grouphead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.modelsSection }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dsha-btn",
										disabled: busy !== null || !configured,
										onClick: () => void run("catalog", async () => {
											const updated = await aiStudioApi.request("/catalog/refresh", { method: "POST" });
											setNotice(`已从官方目录同步（共 ${(updated?.models ?? []).length} 个模型）。`);
											return updated;
										}),
										children: busy === "catalog" ? t.refreshingCatalog : t.refreshCatalog
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted dsha-models-hint", children: t.modelsHint }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelChecklist, {
								items: (status?.models ?? []).map(model => ({
									id: model.id,
									name: model.name,
									hint: model.defaultContextWindow ? formatCapacity(model.defaultContextWindow) : void 0,
									enabled: model.enabled
								})),
								busy: busy !== null,
								onToggle: (id, enabled) => void toggleModel(id, enabled),
								onToggleAll: setAllModels,
								labels: { selectAll: t.selectAll, clearAll: t.unselectAll, list: t.modelsSection }
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsha-grouphead", children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.enhanced }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsha-pref-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t.defaultReasoningEffort }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.defaultReasoningEffortHint })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dsha-select",
										value: status?.defaultReasoningEffort ?? "",
										disabled: busy !== null,
										onChange: (event) => void saveSettings({ defaultReasoningEffort: event.currentTarget.value }),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: "", children: t.defaultEffortAuto }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: "low", children: "Low" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: "medium", children: "Medium" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: "high", children: "High" })
										]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsha-group",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsha-grouphead", children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t.contextWindowSection }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-muted", children: t.contextWindowHint }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextWindowEditor, {
								rows: enabledModels.map(model => ({
									id: model.id,
									name: model.name,
									draft: contextDrafts[model.id] ?? "",
									hasOverride: status?.contextWindowOverrides[model.id] !== void 0,
									saving: savingModel === model.id,
									inputLabel: `${model.name} 上下文容量`
								})),
								labels: {
									tokens: t.tokens,
									save: t.save,
									saving: t.saving,
									reset: t.contextWindowReset,
									resetAll: t.contextWindowResetAll,
									empty: t.contextWindowNoneEnabled
								},
								busy: busy !== null,
								overrideCount,
								onDraftChange: (id, draft) => setContextDrafts(prev => ({ ...prev, [id]: draft })),
								onCommit: saveContext,
								onReset: resetContext,
								onResetAll: resetAllContext
							})
						]
					}),
					notice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-notice", children: notice }) : null,
					error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { className: "dsha-notice", children: `Google AI Studio：${error}` }) : null
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		const inject = [
			"slots",
			"locale",
			"modelDirectories",
			"conversation",
			"sessions",
			"remote",
			"remote.session"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, dictionaries$1), "dsh-workbuddy: codex dictionaries");
			ctx.effect(() => installStyles(), "dsh-workbuddy: main styles");
			ctx.effect(() => {
				installHubStyles();
				installModelChecklistStyles();
				installPoolStyles();
				return () => {};
			}, "dsh-workbuddy: hub & checklist & pool styles");
			ctx.effect(() => ctx.locale.register(NS_ANTIGRAVITY, dictionaries$10), "dsh-workbuddy: antigravity dictionaries");
			ctx.effect(() => {
				installAntigravityStyles();
				return () => {};
			}, "dsh-workbuddy: antigravity styles");
			ctx.effect(() => ctx.locale.register(NS_WORKBUDDY, dictionaries$7), "dsh-workbuddy: dictionaries");
			ctx.effect(() => {
				installWorkBuddyStyles();
				return () => {};
			}, "dsh-workbuddy: styles");

			const handleModelDirectoryReload = () => {
				try {
					const conv = ctx.conversation;
					const activeSessionId = conv?.activeSessionId || conv?.currentSessionId || conv?.activeId;
					if (activeSessionId && ctx.modelDirectories) ctx.modelDirectories.directoryFor(activeSessionId)?.load?.().catch?.(() => void 0);
				} catch {}
			};
			const CustomChannelsHubWrapper = (props) => {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderHubSection, {
					...props,
					onModelChange: () => {
						props.onModelChange?.();
						handleModelDirectoryReload();
					}
				});
			};

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "workbuddy-subscription-settings",
				order: 48,
				label: () => "自制渠道",
				locale: NS
			}, CustomChannelsHubWrapper));

			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "wb-codex-subscription-quota",
				order: 35,
				locale: NS,
				inject: (sessionId) => composerBadgeInject(ctx, sessionId, { withApi: true })
			}, CodexComposerQuota));

			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "wb-antigravity-quota",
				order: 36,
				locale: NS_ANTIGRAVITY,
				inject: (sessionId) => composerBadgeInject(ctx, sessionId)
			}, AntigravityComposerQuota));

			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "workbuddy-quota",
				order: 39,
				locale: NS_WORKBUDDY,
				inject: (sessionId) => composerBadgeInject(ctx, sessionId)
			}, WorkBuddyComposerQuota));

			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: CODEX_IMAGE_TOOL_NAME,
				locale: NS,
				inject: (sessionId) => ({ loadImage: imageLoader(ctx, sessionId) })
			}, CodexImageToolView));

			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: ANTIGRAVITY_IMAGE_TOOL_NAME,
				locale: NS,
				inject: (sessionId) => ({ loadImage: imageLoader(ctx, sessionId) })
			}, CodexImageToolView));
		}
		/**
		* The seats every composer badge is handed.
		*
		* Seven registrations each repeated this eight-line factory verbatim, and the
		* only difference between them was whether ChatGPT's own badge also reads the
		* subscription API directly. It lives here so a badge added later cannot forget
		* the directory seat (the badge resolves the session's model list through it) or
		* the reload callback that keeps that list fresh.
		*
		* The session id arrives as a plain string while the directory service takes the
		* branded one, so the cast lives here rather than at seven call sites.
		*/
		function composerBadgeInject(ctx, sessionId, options = {}) {
			const directory = ctx.modelDirectories.directoryFor(sessionId);
			return {
				...options.withApi === true ? { api: new SubscriptionApi() } : {},
				directory: directory.store,
				loadModelDirectory: () => {
					directory.load().catch(() => void 0);
				}
			};
		}
		/**
		* Why the seven registrations below are spelled out rather than driven from a
		* table.
		*
		* `ctx.slots.register` is generic over the slot key *and* the locale namespace,
		* and it is overloaded; the component's props are composed from both. A table
		* would have to hold components of different namespaces, so the correlation
		* between a row's `locale` and its `component` would be erased — and a helper
		* that keeps the correlation generically fails overload resolution inside its
		* own body, because the namespace parameter is still unresolved there. Both
		* roads end in a cast against the harness's composed-props internals, which is a
		* version-sensitive seam this plugin does not add. What each row repeats is only
		* the registration object; the eight-line seat factory is
		* {@link composerBadgeInject}.
		*/
		/**
		* Resolve one session-authorized image URL.
		*
		* Harness 0.1.2 moved this from `resolveImage` on `conversation` to `imageUrl`
		* on `uiConversation`, so both shapes stay supported.
		*/
		function imageLoader(ctx, sessionId) {
			const current = ctx.get("uiConversation");
			const currentResolve = current?.imageUrl?.bind(current);
			if (currentResolve !== void 0) return (attachment) => currentResolve(sessionId, attachment);
			const legacy = ctx.get("conversation");
			const legacyResolve = legacy?.resolveImage?.bind(legacy);
			if (legacyResolve !== void 0) return (attachment) => legacyResolve(sessionId, attachment);
			return () => Promise.reject(/* @__PURE__ */ new Error("no client service resolves an image URL"));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map