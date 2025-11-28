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

export const codeBlock = (code: string, language = 'swift'): string => `\`\`\`${language}\n${code}\n\`\`\``;

export const inlineCode = (code: string): string => `\`${code}\``;

export const warning = (message: string): string => `> ⚠️ **Warning:** ${message}`;

export const deprecationWarning = (platform: string, message?: string): string => {
	const base = `> ⚠️ **Deprecated** on ${platform}`;
	return message ? `${base}: ${message}` : base;
};

export const availabilityBadge = (platform: string, version: string, options?: {
	deprecated?: boolean;
	beta?: boolean;
	unavailable?: boolean;
}): string => {
	const badges: string[] = [];
	if (options?.deprecated) {
		badges.push('⚠️');
	}

	if (options?.beta) {
		badges.push('β');
	}

	if (options?.unavailable) {
		return `${platform}: ~~unavailable~~`;
	}

	const prefix = badges.length > 0 ? `${badges.join('')} ` : '';
	return `${prefix}${platform} ${version}+`;
};
