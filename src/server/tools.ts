import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {ServerContext} from './context.js';
import {buildDiscoverHandler} from './handlers/discover.js';
import {buildChooseTechnologyHandler} from './handlers/choose-technology.js';
import {buildCurrentTechnologyHandler} from './handlers/current-technology.js';
import {buildGetDocumentationHandler} from './handlers/get-documentation.js';
import {buildSearchSymbolsHandler} from './handlers/search-symbols.js';
import {buildVersionHandler} from './handlers/version.js';
import {buildCacheStatusHandler} from './handlers/cache-status.js';

export const registerTools = (server: McpServer, context: ServerContext) => {
	const discoverHandler = buildDiscoverHandler(context);
	server.registerTool(
		'discover_technologies',
		{
			description: 'Explore and filter available Apple technologies/frameworks before choosing one',
			inputSchema: {
				page: z.number().optional().describe('Optional page number (default 1)'),
				pageSize: z.number().optional().describe('Optional page size (default 25, max 100)'),
				query: z.string().optional().describe('Optional keyword to filter technologies'),
			},
		},
		async args => discoverHandler(args),
	);

	const chooseTechnologyHandler = buildChooseTechnologyHandler(context);
	server.registerTool(
		'choose_technology',
		{
			description: 'Select the framework/technology to scope all subsequent searches and documentation lookups',
			inputSchema: {
				identifier: z.string().optional().describe('Optional technology identifier (e.g. doc://.../SwiftUI)'),
				name: z.string().optional().describe('Technology name/title (e.g. SwiftUI)'),
			},
		},
		async args => chooseTechnologyHandler(args),
	);

	const currentTechnologyHandler = buildCurrentTechnologyHandler(context);
	server.registerTool(
		'current_technology',
		{
			description: 'Report the currently selected technology and how to change it',
		},
		async () => currentTechnologyHandler(),
	);

	const getDocumentationHandler = buildGetDocumentationHandler(context);
	server.registerTool(
		'get_documentation',
		{
			description: 'Get detailed documentation for specific symbols within the selected technology. '
				+ 'Use this for known symbol names (e.g., "View", "Button", "GridItem"). Accepts relative symbol names.',
			inputSchema: {
				path: z.string().describe('Symbol path or relative name (e.g. "View", "GridItem", "Button")'),
			},
		},
		async args => getDocumentationHandler(args),
	);

	const searchSymbolsHandler = buildSearchSymbolsHandler(context);
	server.registerTool(
		'search_symbols',
		{
			description: 'Search and discover symbols within the currently selected technology. '
				+ 'Use this for exploration and finding symbols by keywords. Supports wildcards (* and ?). '
				+ 'For specific known symbols, use get_documentation instead.',
			inputSchema: {
				query: z.string().describe('Search keywords with wildcard support (* for any characters, ? for single character)'),
				maxResults: z.number().optional().describe('Optional maximum number of results (default 20)'),
				platform: z.string().optional().describe('Optional platform filter (iOS, macOS, etc.)'),
				symbolType: z.string().optional().describe('Optional symbol kind filter (class, protocol, etc.)'),
			},
		},
		async args => searchSymbolsHandler(args),
	);

	const versionHandler = buildVersionHandler();
	server.registerTool(
		'get_version',
		{
			description: 'Get the current version information of the Apple Doc MCP server',
		},
		async () => versionHandler(),
	);

	const cacheStatusHandler = buildCacheStatusHandler();
	server.registerTool(
		'cache_status',
		{
			description: 'View cache status including cached frameworks, size, and diagnostic information',
		},
		async () => cacheStatusHandler(),
	);
};
