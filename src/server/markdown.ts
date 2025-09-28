export const header = (level: number, text: string): string => `${'#'.repeat(Math.max(1, level))} ${text}`;

export const bold = (label: string, value: string): string => `**${label}:** ${value}`;

export const list = (items: string[], bullet = '•'): string => items.map(item => `${bullet} ${item}`).join('\n');

export const blankLine = (): string => '';

export const paragraph = (text: string): string => text;

export const section = (title: string, body: string[]): string[] => [header(2, title), ...body, blankLine()];

export const trimWithEllipsis = (text: string, maxLength: number): string => {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, Math.max(0, maxLength))}...`;
};
