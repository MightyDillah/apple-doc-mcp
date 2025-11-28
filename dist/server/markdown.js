export const header = (level, text) => `${'#'.repeat(Math.max(1, level))} ${text}`;
export const bold = (label, value) => `**${label}:** ${value}`;
export const list = (items, bullet = '•') => items.map(item => `${bullet} ${item}`).join('\n');
export const blankLine = () => '';
export const paragraph = (text) => text;
export const section = (title, body) => [header(2, title), ...body, blankLine()];
export const trimWithEllipsis = (text, maxLength) => {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, Math.max(0, maxLength))}...`;
};
export const codeBlock = (code, language = 'swift') => `\`\`\`${language}\n${code}\n\`\`\``;
export const inlineCode = (code) => `\`${code}\``;
export const warning = (message) => `> ⚠️ **Warning:** ${message}`;
export const deprecationWarning = (platform, message) => {
    const base = `> ⚠️ **Deprecated** on ${platform}`;
    return message ? `${base}: ${message}` : base;
};
export const availabilityBadge = (platform, version, options) => {
    const badges = [];
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
//# sourceMappingURL=markdown.js.map