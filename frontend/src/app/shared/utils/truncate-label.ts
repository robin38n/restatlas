/** Truncate a label to fit within maxWidth, given an approximate charWidth (px). */
export function truncateLabel(
	text: string,
	maxWidth: number,
	charWidth: number,
): string {
	const padding = 24;
	const maxChars = Math.floor((maxWidth - padding) / charWidth);
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars - 1)}\u2026`;
}
