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
//# sourceMappingURL=markdown.js.map