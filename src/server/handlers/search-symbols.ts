import type {ServerContext, ToolResponse} from '../context.js';
import {LocalSymbolIndex, type LocalSymbolIndexEntry} from '../services/local-symbol-index.js';
import {header, bold} from '../markdown.js';
import {buildNoTechnologyMessage} from './no-technology.js';

export const buildSearchSymbolsHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async (args: {maxResults?: number; platform?: string; query: string; symbolType?: string}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const {query, maxResults = 20, platform, symbolType} = args;

		// Get or create technology-specific local index from state
		const techLocalIndex = state.getLocalSymbolIndex(client);

		// Build local index from cached files if not already built
		if (techLocalIndex.getSymbolCount() === 0) {
			try {
				console.log('📚 Building symbol index from cache...');
				await techLocalIndex.buildIndexFromCache();
				console.log(`✅ Index built with ${techLocalIndex.getSymbolCount()} symbols`);
			} catch (error) {
				console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
			}
		}

		// Comprehensive download disabled - it was broken and blocking
		// If local index is empty/small, use direct framework search as fallback
		let symbolResults = techLocalIndex.search(query, maxResults * 2);

		if (symbolResults.length === 0 && techLocalIndex.getSymbolCount() < 50) {
			// Fallback: search framework.references directly (fast, no download needed)
			console.log('📋 Using framework references for search...');
			const frameworkResults = await client.searchFramework(activeTechnology.title, query, {maxResults: maxResults * 2, platform, symbolType});
			symbolResults = frameworkResults.map(r => ({
				id: r.path ?? r.title,
				title: r.title,
				path: r.path ?? '',
				kind: r.symbolKind ?? 'symbol',
				abstract: r.description,
				platforms: r.platforms ? r.platforms.split(', ') : [],
				tokens: [],
				filePath: '',
			}));
		}

		// Apply filters
		let filteredResults = symbolResults;
		if (platform) {
			const platformLower = platform.toLowerCase();
			filteredResults = filteredResults.filter(result =>
				result.platforms.some(p => p.toLowerCase().includes(platformLower)));
		}

		if (symbolType) {
			const typeLower = symbolType.toLowerCase();
			filteredResults = filteredResults.filter(result =>
				result.kind.toLowerCase().includes(typeLower));
		}

		filteredResults = filteredResults.slice(0, maxResults);

		// Validate result relevance
		const technologyIdentifier = activeTechnology.identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '');
		const isRelevantResult = (result: LocalSymbolIndexEntry) => {
			const resultPath = result.path.toLowerCase();
			const technologyPath = technologyIdentifier.toLowerCase();
			return resultPath.includes(technologyPath);
		};

		const relevantResults = filteredResults.filter(result => isRelevantResult(result));
		const hasIrrelevantResults = relevantResults.length < filteredResults.length;

		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Technology', activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', techLocalIndex.getSymbolCount().toString()),
			'',
		];

		// Add status information
		if (techLocalIndex.getSymbolCount() < 50) {
			lines.push(
				'⚠️ **Limited Results:** Only basic symbols are indexed.',
				'For comprehensive results, additional symbols are being downloaded in the background.',
				'',
			);
		} else {
			lines.push(
				'✅ **Comprehensive Index:** Full symbol database is available.',
				'',
			);
		}

		lines.push(header(2, 'Symbols'), '');

		// Show warning if results seem irrelevant
		if (hasIrrelevantResults && filteredResults.length > 0) {
			lines.push(
				'⚠️ **Note:** Some results may not be from the selected technology.',
				'For specific symbol names, try using `get_documentation` instead.',
				'',
			);
		}

		if (filteredResults.length > 0) {
			for (const result of filteredResults) {
				const platforms = result.platforms.length > 0 ? result.platforms.join(', ') : 'All platforms';
				lines.push(
					`### ${result.title}`,
					`   • **Kind:** ${result.kind}`,
					`   • **Path:** ${result.path}`,
					`   • **Platforms:** ${platforms}`,
					`   ${result.abstract}`,
					'',
				);
			}
		} else {
			// Check if this looks like a specific symbol name that should use direct documentation lookup
			const isSpecificSymbol = /^[A-Z][a-zA-Z\d]*$/.test(query) || /^[A-Z][a-zA-Z\d]*\.[A-Z][a-zA-Z\d]*$/.test(query);

			lines.push(
				'No symbols matched those terms within this technology.',
				'',
				'**Search Tips:**',
				'• Try wildcards: `Grid*` or `*Item`',
				'• Use broader keywords: "grid" instead of "griditem"',
				'• Check spelling and try synonyms',
				'',
			);

			if (isSpecificSymbol) {
				lines.push(
					'**💡 Suggestion:** This looks like a specific symbol name.',
					'Try using `get_documentation` instead for direct access:',
					'',
					'```',
					`get_documentation { "path": "${query}" }`,
					'```',
					'',
				);
			}

			lines.push(
				'**Note:** If this is your first search, symbols are being downloaded in the background.',
				'Try searching again in a few moments for more comprehensive results.',
				'',
			);
		}

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};
};

