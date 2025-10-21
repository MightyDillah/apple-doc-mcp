import type {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext} from './context.js';
import {buildDiscoverHandler} from './handlers/discover.js';
import {buildChooseTechnologyHandler} from './handlers/choose-technology.js';
import {buildCurrentTechnologyHandler} from './handlers/current-technology.js';
import {buildGetDocumentationHandler} from './handlers/get-documentation.js';
import {buildSearchSymbolsHandler} from './handlers/search-symbols.js';
import {buildVersionHandler} from './handlers/version.js';

type ToolDefinition = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: (args: any) => Promise<{content: Array<{text: string; type: 'text'}>}>;
};

export const registerTools = (server: Server, context: ServerContext) => {
	const toolDefinitions: ToolDefinition[] = [
		{
			name: 'discover_technologies',
			description: 'Explore and filter available Apple technologies/frameworks before choosing one',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {
					page: {
						type: 'number',
						description: 'Optional page number (default 1)',
					},
					pageSize: {
						type: 'number',
						description: 'Optional page size (default 25, max 100)',
					},
					query: {
						type: 'string',
						description: 'Optional keyword to filter technologies',
					},
				},
			},
			handler: buildDiscoverHandler(context),
		},
		{
			name: 'choose_technology',
			description: 'Select the framework/technology to scope all subsequent searches and documentation lookups',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {
					identifier: {
						type: 'string',
						description: 'Optional technology identifier (e.g. doc://.../SwiftUI)',
					},
					name: {
						type: 'string',
						description: 'Technology name/title (e.g. SwiftUI)',
					},
				},
			},
			handler: buildChooseTechnologyHandler(context),
		},
		{
			name: 'current_technology',
			description: 'Report the currently selected technology and how to change it',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildCurrentTechnologyHandler(context),
		},
		{
			name: 'get_documentation',
			description: 'Get detailed documentation for symbols within the selected technology (accepts relative symbol names)',
			inputSchema: {
				type: 'object',
				required: ['path'],
				properties: {
					path: {
						type: 'string',
						description: 'Symbol path or relative name (e.g. "View")',
					},
				},
			},
			handler: buildGetDocumentationHandler(context),
		},
		{
			name: 'search_symbols',
			description: 'Search symbols within the currently selected technology (supports wildcards: * and ?)',
			inputSchema: {
				type: 'object',
				required: ['query'],
				properties: {
					maxResults: {
						type: 'number',
						description: 'Optional maximum number of results (default 20)',
					},
					platform: {
						type: 'string',
						description: 'Optional platform filter (iOS, macOS, etc.)',
					},
					query: {
						type: 'string',
						description: 'Search keywords with wildcard support (* for any characters, ? for single character)',
					},
					symbolType: {
						type: 'string',
						description: 'Optional symbol kind filter (class, protocol, etc.)',
					},
				},
			},
			handler: buildSearchSymbolsHandler(context),
		},
		{
			name: 'get_version',
			description: 'Get the current version information of the Apple Doc MCP server',
			inputSchema: {
				type: 'object',
				required: [],
				properties: {},
			},
			handler: buildVersionHandler(),
		},
	];

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: toolDefinitions.map(({name, description, inputSchema}) => ({name, description, inputSchema})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async request => {
		const tool = toolDefinitions.find(entry => entry.name === request.params.name);
		if (!tool) {
			throw new Error(`Unknown tool: ${request.params.name}`);
		}

		return tool.handler(request.params.arguments ?? {});
	});
};

