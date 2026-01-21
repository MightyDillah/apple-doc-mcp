import type {ServerContext, ToolResponse} from '../context.js';
import type {LocalSymbolIndex, LocalSymbolIndexEntry, ScoredSearchResult} from '../services/local-symbol-index.js';
import type {IndexerStatus} from '../services/progressive-symbol-indexer.js';
import {header, bold} from '../markdown.js';
import {buildNoTechnologyMessage} from './no-technology.js';
import {looksLikeInfoPlistKey} from '../utils/info-plist-keys.js';

// Absolute minimum score - anything below this is definitely noise
const absoluteMinScore = 5;

// Minimum results to show before relaxing threshold
const minResultsBeforeRelaxing = 5;

/**
 * Calculate dynamic relevance threshold based on search results
 * Uses relative scoring: threshold is a percentage of the top score
 * This ensures we filter noise while still returning relevant results
 */
const calculateDynamicThreshold = (
	scoredResults: ScoredSearchResult[],
	requestedMax: number,
): number => {
	if (scoredResults.length === 0) {
		return 0;
	}

	const topScore = scoredResults[0].score;

	// Base threshold: 5% of top score, but at least absoluteMinScore
	const baseThreshold = Math.max(absoluteMinScore, topScore * 0.05);

	// Count how many results are above base threshold
	const aboveThreshold = scoredResults.filter(r => r.score >= baseThreshold);

	// If we have very few results above threshold, relax it
	if (aboveThreshold.length < Math.min(minResultsBeforeRelaxing, requestedMax)) {
		// Relaxed threshold: 1% of top score, but at least absoluteMinScore
		return Math.max(absoluteMinScore, topScore * 0.01);
	}

	return baseThreshold;
};

/**
 * Extract framework API path name from technology identifier
 * e.g., "doc://com.apple.documentation/documentation/DeviceManagement" -> "DeviceManagement"
 */
const extractFrameworkName = (identifier: string): string => {
	const parts = identifier.split('/');
	return parts.at(-1) ?? '';
};

type SearchArgs = {
	maxResults?: number;
	platform?: string;
	query: string;
	symbolType?: string;
};

const buildIndexStatusMessage = (indexerStatus: IndexerStatus | undefined, symbolCount: number): string[] => {
	const lines: string[] = [];

	if (indexerStatus?.isRunning) {
		lines.push(
			`🔄 **Indexing in progress:** ${indexerStatus.downloadedCount}/${indexerStatus.totalQueued} symbols indexed`,
			'Search results will improve as more symbols are indexed.',
			'',
		);
	} else if (symbolCount < 50) {
		lines.push(
			'⚠️ **Limited Index:** Only basic symbols are available.',
			'Try selecting the technology again to start background indexing.',
			'',
		);
	} else {
		lines.push(
			`✅ **Symbol Index:** ${symbolCount} symbols available.`,
			'',
		);
	}

	return lines;
};

const buildNoResultsMessage = (query: string, technologyTitle: string, symbolCount: number): string[] => {
	const lines: string[] = [];

	// Check if this looks like a specific symbol name
	const isSpecificSymbol = /^[A-Z][a-zA-Z\d]*$/.test(query)
		|| /^[A-Z][a-zA-Z\d]*\.[A-Z][a-zA-Z\d]*$/.test(query)
		|| looksLikeInfoPlistKey(query);

	lines.push(`No relevant symbols found for "${query}" within ${technologyTitle}.`, '');

	if (looksLikeInfoPlistKey(query)) {
		lines.push(
			'**💡 This looks like an Info.plist key.**',
			'Try using `get_documentation` for direct access:',
			'',
			'```',
			`get_documentation { "path": "${query}" }`,
			'```',
			'',
			'Or switch to Bundle Resources technology:',
			'```',
			'choose_technology { "name": "Bundle Resources" }',
			'```',
			'',
		);
	} else if (isSpecificSymbol) {
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
		'**Search Tips:**',
		'• Try wildcards: `Grid*` or `*Item`',
		'• Use broader keywords: "grid" instead of "griditem"',
		'• Check spelling and try synonyms',
		'• For Info.plist keys, try using `discover_technologies { "query": "bundle" }`',
		'',
	);

	if (symbolCount < 50) {
		lines.push(
			'**Note:** Symbol index is still building.',
			'Try searching again shortly for more comprehensive results.',
			'',
		);
	}

	return lines;
};

const filterResults = (
	results: LocalSymbolIndexEntry[],
	platform: string | undefined,
	symbolType: string | undefined,
	maxResults: number,
): LocalSymbolIndexEntry[] => {
	let filtered = results;

	if (platform) {
		const platformLower = platform.toLowerCase();
		filtered = filtered.filter(result =>
			result.platforms.some(p => p.toLowerCase().includes(platformLower)));
	}

	if (symbolType) {
		const typeLower = symbolType.toLowerCase();
		filtered = filtered.filter(result =>
			result.kind.toLowerCase().includes(typeLower));
	}

	return filtered.slice(0, maxResults);
};

const buildLocalIndex = async (techLocalIndex: LocalSymbolIndex): Promise<void> => {
	if (techLocalIndex.getSymbolCount() === 0) {
		console.error('📚 Building symbol index from cache...');
		await techLocalIndex.buildIndexFromCache();
		console.error(`✅ Index built with ${techLocalIndex.getSymbolCount()} symbols`);
	}
};

export const buildSearchSymbolsHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async (args: SearchArgs): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const {query, maxResults = 20, platform, symbolType} = args;
		const techLocalIndex = state.getLocalSymbolIndex(client);

		// Build local index from cached files if not already built
		try {
			await buildLocalIndex(techLocalIndex);
		} catch (error) {
			console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
		}

		// Search with scores and apply dynamic threshold
		const allScoredResults = techLocalIndex.searchWithScores(query, maxResults * 2);
		const dynamicThreshold = calculateDynamicThreshold(allScoredResults, maxResults);
		const scoredResults = allScoredResults.filter(r => r.score >= dynamicThreshold);

		let symbolResults = scoredResults.map(r => r.entry);

		// Fallback to framework references if index is small and no results
		if (symbolResults.length === 0 && techLocalIndex.getSymbolCount() < 50) {
			console.error('📋 Using framework references for search...');
			const frameworkName = extractFrameworkName(activeTechnology.identifier);
			const frameworkResults = await client.searchFramework(frameworkName, query, {maxResults: maxResults * 2, platform, symbolType});
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

		const filteredResults = filterResults(symbolResults, platform, symbolType, maxResults);

		// Check for irrelevant results
		const technologyPath = activeTechnology.identifier
			.replace('doc://com.apple.documentation/', '')
			.replace(/^documentation\//, '')
			.toLowerCase();
		const hasIrrelevantResults = filteredResults.some(r => !r.path.toLowerCase().includes(technologyPath));

		// Build output
		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Technology', activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', techLocalIndex.getSymbolCount().toString()),
			'',
			...buildIndexStatusMessage(state.getIndexerStatus(), techLocalIndex.getSymbolCount()),
		];

		lines.push(header(2, 'Symbols'), '');

		// Add Info.plist key suggestion if query looks like one
		if (looksLikeInfoPlistKey(query) && filteredResults.length > 0) {
			lines.push(
				'**💡 This looks like an Info.plist key.**',
				'For direct documentation, try:',
				`\`get_documentation { "path": "${query}" }\``,
				'',
			);
		} else if (hasIrrelevantResults && filteredResults.length > 0) {
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
			lines.push(...buildNoResultsMessage(query, activeTechnology.title, techLocalIndex.getSymbolCount()));
		}

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};
};
