import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {FrameworkData, ReferenceData, SymbolData} from '../../apple-client.js';
import type {ServerContext} from '../context.js';

const tokenize = (value: string | undefined): string[] => {
	if (!value) {
		return [];
	}

	const tokens = new Set<string>();

	// Split on common delimiters
	const basicTokens = value.split(/[\s/._-]+/).filter(Boolean);

	for (const token of basicTokens) {
		// Add lowercase version
		tokens.add(token.toLowerCase());

		// Add original case version for exact matches
		tokens.add(token);

		// Handle camelCase/PascalCase (e.g., GridItem -> grid, item, griditem)
		const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
		if (camelParts.length > 1) {
			for (const part of camelParts) {
				tokens.add(part.toLowerCase());
				tokens.add(part);
			}

			// Add concatenated lowercase version
			tokens.add(camelParts.join('').toLowerCase());
		}
	}

	return [...tokens];
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
	const frameworkName = identifierParts.at(-1);
	if (!frameworkName) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`Invalid technology identifier: ${activeTechnology.identifier}`,
		);
	}

	const data = await client.getFramework(frameworkName);
	state.setActiveFrameworkData(data);
	state.clearFrameworkIndex();
	return data;
};

const buildEntry = (id: string, ref: ReferenceData, extractText: (abstract?: ReferenceData['abstract']) => string) => {
	const tokens = new Set<string>();
	for (const token of tokenize(ref.title)) {
		tokens.add(token);
	}

	for (const token of tokenize(ref.url)) {
		tokens.add(token);
	}

	const abstractText = extractText(ref.abstract);
	for (const token of tokenize(abstractText)) {
		tokens.add(token);
	}

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
	const frameworkName = identifierParts.at(-1);
	if (!frameworkName) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`Invalid technology identifier: ${activeTechnology.identifier}`,
		);
	}

	const index = (await ensureFrameworkIndex(context));

	const identifiersToProcess = identifiers.filter(identifier => !state.hasExpandedIdentifier(identifier));

	const promises = identifiersToProcess.map(async identifier => {
		try {
			const symbolPath = identifier
				.replace('doc://com.apple.documentation/', '')
				.replace(/^documentation\//, 'documentation/');
			const data: SymbolData = await client.getSymbol(symbolPath);
			return {data, identifier};
		} catch (error) {
			console.warn(`Failed to expand identifier ${identifier}:`, error instanceof Error ? error.message : String(error));
			return null;
		}
	});

	const results = await Promise.all(promises);
	for (const result of results) {
		if (result) {
			const {data, identifier} = result;
			processReferences(data.references, index, client.extractText.bind(client));
			state.markIdentifierExpanded(identifier);
		}
	}

	return index;
};

export const getFrameworkIndexEntries = async (context: ServerContext) => {
	const index = await ensureFrameworkIndex(context);
	return [...index.values()];
};

