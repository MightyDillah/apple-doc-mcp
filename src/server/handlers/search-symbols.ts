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

		// Create technology-specific local index
		const technologyIdentifier = activeTechnology.identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '');
		const techLocalIndex = new LocalSymbolIndex(client, technologyIdentifier);

		// Build local index from cached files if not already built
		if (techLocalIndex.getSymbolCount() === 0) {
			try {
				await techLocalIndex.buildIndexFromCache();
			} catch (error) {
				console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
			}
		}

		// If we have very few symbols, try downloading more
		if (techLocalIndex.getSymbolCount() < 50) {
			try {
				console.log('Downloading comprehensive symbol data...');
				await downloader.downloadAllSymbols(context);
				await techLocalIndex.buildIndexFromCache(); // Rebuild index with new data
			} catch (error) {
				console.warn('Failed to download comprehensive symbols:', error instanceof Error ? error.message : String(error));
			}
		}

		// Search using technology-specific local index
		const symbolResults = techLocalIndex.search(query, maxResults * 2);
		
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

		// Validate result relevance
		const isRelevantResult = (result: any) => {
			const resultPath = result.path.toLowerCase();
			const technologyPath = technologyIdentifier.toLowerCase();
			return resultPath.includes(technologyPath);
		};

		const relevantResults = filteredResults.filter(isRelevantResult);
		const hasIrrelevantResults = relevantResults.length < filteredResults.length;

		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Technology', activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', techLocalIndex.getSymbolCount().toString()),
			'',
			header(2, 'Symbols'),
			'',
		];

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
					''
				);
			}
		} else {
			// Check if this looks like a specific symbol name that should use direct documentation lookup
			const isSpecificSymbol = /^[A-Z][a-zA-Z0-9]*$/.test(query) || /^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*$/.test(query);
			
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
					`\`\`\``,
					`get_documentation { "path": "${query}" }`,
					`\`\`\``,
					'',
				);
			}
			
			lines.push(
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

