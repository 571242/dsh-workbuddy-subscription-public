// WorkBuddy Manager PR #325: recover a request-scoped 11128 without penalizing accounts.
export function moveWorkBuddySystemToUser(body) {
	let request;
	try {
		request = JSON.parse(body);
	} catch {
		return null;
	}
	if (!Array.isArray(request?.messages)) return null;
	const messages = request.messages;
	if (messages.some((message) => message === null || typeof message !== "object")) return null;
	const systems = messages.filter((message) => message.role === "system" || message.role === "developer");
	if (systems.some((message) => typeof message.content !== "string")) return null;
	const text = systems.map((message) => message.content).filter((content) => content.trim() !== "").join("\n\n");
	const firstUser = messages.find((message) => message.role === "user");
	if (text === "" || typeof firstUser?.content !== "string") return null;
	return JSON.stringify({
		...request,
		messages: [
			{ role: "system", content: "You are a helpful assistant." },
			...messages.filter((message) => message.role !== "system" && message.role !== "developer")
				.map((message) => message === firstUser ? { ...message, content: `${text}\n\n${message.content}` } : message)
		]
	});
}

export function fetchWithWorkBuddyChannelRecovery(fetchFn) {
	return async (input, init) => {
		const response = await fetchFn(input, init);
		if (response.ok || typeof init?.body !== "string") return response;
		const error = await response.clone().json().catch(() => null);
		if (error?.code !== 11128) return response;
		const body = moveWorkBuddySystemToUser(init.body);
		if (body === null) return response;
		init.signal?.throwIfAborted();
		await response.body?.cancel().catch(() => undefined);
		// Exactly one retry, on the same credential; never recurse or rotate accounts.
		return fetchFn(input, { ...init, body });
	};
}
