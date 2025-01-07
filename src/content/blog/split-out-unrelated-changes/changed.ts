export function repeatMessage(times: number, messages: string[]) {
	for (let i = 0; i < times; i += 1) {
		for (const message of messages) {
			console.log(message);
		}
	}
}
