import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {FrameworkData, ReferenceData, SymbolData} from '../../apple-client.js';
import type {ServerContext} from '../context.js';

const tokenize = (value: string | undefined): string[] => {
	if (!value) {
		return [];
	}

	return value
		.split(/[\s/._-]+/)
		.map(token => token.toLowerCase())
		.filter(Boolean);
};

export const loadActiveFrameworkData = async ({client, state}: ServerContext): Promise<FrameworkData> => {
	const activeTechnology = state.getActiveTechnology();
	if (!activeTechnology) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			'No technology selected. Use `discover_technologies` then `choose_technology` first.',
		);
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

const buildEntry = (id: string, ref: ReferenceData, extractText: (abstract?: ReferenceData['abstract']) => string) => {
	const tokens = new Set<string>();
	tokenize(ref.title).forEach(token => tokens.add(token));
	tokenize(ref.url).forEach(token => tokens.add(token));
	const abstractText = extractText(ref.abstract);
	tokenize(abstractText).forEach(token => tokens.add(token));
	return {id, ref, tokens: [...tokens]};
};

const processReferences = (
	references: Record<string, ReferenceData>,
	index: Map<string, {id: string; ref: ReferenceData; tokens: string[]}>,
	extractText: (abstract?: ReferenceData['abstract']) => string,
) => {
	for (const [id, ref] of Object.entries(references)) {
		if (!index.has(id)) {
			index.set(id, buildEntry(id, ref, extractText));
		}
	}
};

export const ensureFrameworkIndex = async (context: ServerContext) => {
	const {client, state} = context;
	const framework = await loadActiveFrameworkData(context);
	const existing = state.getFrameworkIndex();
	if (existing) {
		return existing;
	}

	const index = new Map<string, {id: string; ref: ReferenceData; tokens: string[]}>();
	const extract = client.extractText.bind(client);

	processReferences(framework.references, index, extract);

	state.setFrameworkIndex(index);

	return index;
};

export const expandSymbolReferences = async (
	context: ServerContext,
	identifiers: string[],
): Promise<Map<string, {id: string; ref: ReferenceData; tokens: string[]}>> => {
	const {client, state} = context;
	const activeTechnology = state.getActiveTechnology();
	if (!activeTechnology) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			'No technology selected. Use `discover_technologies` then `choose_technology` first.',
		);
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
			const data: SymbolData = await client.getSymbol(symbolPath);
			processReferences(data.references, index, client.extractText.bind(client));
			state.markIdentifierExpanded(identifier);
		} catch (error) {
			console.warn(`Failed to expand identifier ${identifier}:`, error instanceof Error ? error.message : String(error));
		}
	}

	return index;
};

export const getFrameworkIndexEntries = async (context: ServerContext) => {
	const index = await ensureFrameworkIndex(context);
	return Array.from(index.values());
};

