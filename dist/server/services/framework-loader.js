import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
const tokenize = (value) => {
    if (!value) {
        return [];
    }
    return value
        .split(/[\s/._-]+/)
        .map(token => token.toLowerCase())
        .filter(Boolean);
};
export const loadActiveFrameworkData = async ({ client, state }) => {
    const activeTechnology = state.getActiveTechnology();
    if (!activeTechnology) {
        throw new McpError(ErrorCode.InvalidRequest, 'No technology selected. Use `discover_technologies` then `choose_technology` first.');
    }
    const cached = state.getActiveFrameworkData();
    if (cached) {
        return cached;
    }
    const identifierParts = activeTechnology.identifier.split('/');
    const frameworkName = identifierParts[identifierParts.length - 1];
    const data = await client.getFramework(frameworkName);
    state.setActiveFrameworkData(data);
    state.clearFrameworkIndex();
    return data;
};
const buildEntry = (id, ref, extractText) => {
    const tokens = new Set();
    tokenize(ref.title).forEach(token => tokens.add(token));
    tokenize(ref.url).forEach(token => tokens.add(token));
    const abstractText = extractText(ref.abstract);
    tokenize(abstractText).forEach(token => tokens.add(token));
    return { id, ref, tokens: [...tokens] };
};
const processReferences = (references, index, extractText) => {
    for (const [id, ref] of Object.entries(references)) {
        if (!index.has(id)) {
            index.set(id, buildEntry(id, ref, extractText));
        }
    }
};
export const ensureFrameworkIndex = async (context) => {
    const { client, state } = context;
    const framework = await loadActiveFrameworkData(context);
    const existing = state.getFrameworkIndex();
    if (existing) {
        return existing;
    }
    const index = new Map();
    const extract = client.extractText.bind(client);
    processReferences(framework.references, index, extract);
    state.setFrameworkIndex(index);
    return index;
};
export const expandSymbolReferences = async (context, identifiers) => {
    const { client, state } = context;
    const activeTechnology = state.getActiveTechnology();
    if (!activeTechnology) {
        throw new McpError(ErrorCode.InvalidRequest, 'No technology selected. Use `discover_technologies` then `choose_technology` first.');
    }
    const identifierParts = activeTechnology.identifier.split('/');
    const frameworkName = identifierParts[identifierParts.length - 1];
    const index = (await ensureFrameworkIndex(context));
    for (const identifier of identifiers) {
        if (state.hasExpandedIdentifier(identifier)) {
            continue;
        }
        try {
            const symbolPath = identifier
                .replace('doc://com.apple.documentation/', '')
                .replace(/^documentation\//, 'documentation/');
            const data = await client.getSymbol(symbolPath);
            processReferences(data.references, index, client.extractText.bind(client));
            state.markIdentifierExpanded(identifier);
        }
        catch (error) {
            console.warn(`Failed to expand identifier ${identifier}:`, error instanceof Error ? error.message : String(error));
        }
    }
    return index;
};
export const getFrameworkIndexEntries = async (context) => {
    const index = await ensureFrameworkIndex(context);
    return Array.from(index.values());
};
//# sourceMappingURL=framework-loader.js.map