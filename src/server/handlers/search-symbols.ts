import type {ServerContext, ToolResponse} from '../context.js';
import {LocalSymbolIndex} from '../services/local-symbol-index.js';
import {ComprehensiveSymbolDownloader} from '../services/comprehensive-symbol-downloader.js';
import {header, bold} from '../markdown.js';
import {buildNoTechnologyMessage} from './no-technology.js';

export const buildSearchSymbolsHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);
	
	// Create local symbol index and downloader
	const localIndex = new LocalSymbolIndex(client);
	const downloader = new ComprehensiveSymbolDownloader(client);

	return async (args: {maxResults?: number; platform?: string; query: string; symbolType?: string}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return await noTechnology();
		}

		const {query, maxResults = 20, platform, symbolType} = args;

		// Build local index from cached files if not already built
		if (localIndex.getSymbolCount() === 0) {
			try {
				await localIndex.buildIndexFromCache();
			} catch (error) {
				console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
			}
		}

		// If we have very few symbols, try downloading more
		if (localIndex.getSymbolCount() < 50) {
			try {
				console.log('Downloading comprehensive symbol data...');
				await downloader.downloadAllSymbols(context);
				await localIndex.buildIndexFromCache(); // Rebuild index with new data
			} catch (error) {
				console.warn('Failed to download comprehensive symbols:', error instanceof Error ? error.message : String(error));
			}
		}

		// Search using local index
		const symbolResults = localIndex.search(query, maxResults * 2);
		
		// Apply filters
		let filteredResults = symbolResults;
		if (platform) {
			const platformLower = platform.toLowerCase();
			filteredResults = filteredResults.filter(result => 
				result.platforms.some(p => p.toLowerCase().includes(platformLower))
			);
		}
		
		if (symbolType) {
			const typeLower = symbolType.toLowerCase();
			filteredResults = filteredResults.filter(result => 
				result.kind.toLowerCase().includes(typeLower)
			);
		}

		filteredResults = filteredResults.slice(0, maxResults);

		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Technology', activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', localIndex.getSymbolCount().toString()),
			'',
			header(2, 'Symbols'),
			'',
		];

		if (filteredResults.length > 0) {
			for (const result of filteredResults) {
				const platforms = result.platforms.length > 0 ? result.platforms.join(', ') : 'All platforms';
				lines.push(
					`### ${result.title}`,
					`   • **Kind:** ${result.kind}`,
					`   • **Path:** ${result.path}`,
					`   • **Platforms:** ${platforms}`,
					`   ${result.abstract}`,
					''
				);
			}
		} else {
			lines.push(
				'No symbols matched those terms within this technology.',
				'',
				'**Search Tips:**',
				'• Try wildcards: `Grid*` or `*Item`',
				'• Use broader keywords: "grid" instead of "griditem"',
				'• Check spelling and try synonyms',
				'',
				'**Note:** If this is your first search, symbols are being downloaded in the background.',
				'Try searching again in a few moments for more comprehensive results.',
				''
			);
		}

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};
};

