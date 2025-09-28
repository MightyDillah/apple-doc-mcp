import type {ServerContext} from '../../../context.js';
import type {HierarchicalSearchResult, SearchFilters} from '../types.js';
import type {Technology} from '../../../../apple-client.js';
import {performHierarchicalSearch} from './hierarchical-search.js';
import {performRegexSearch} from './regex-search.js';

type FallbackSearchOptions = SearchFilters & {
	maxResults: number;
};

export const performFallbackSearches = async (
	context: ServerContext,
	query: string,
	activeTechnology: Technology,
	options: FallbackSearchOptions,
): Promise<HierarchicalSearchResult[]> => {
	const {client} = context;
	const {maxResults, platform, symbolType} = options;
	let fallbackResults: HierarchicalSearchResult[] = [];

	// Try hierarchical search first
	try {
		fallbackResults = await performHierarchicalSearch(context, query, activeTechnology.title, maxResults);
	} catch (error) {
		console.warn(`Hierarchical search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
	}

	// If still no results, try regex search as final fallback
	if (fallbackResults.length === 0) {
		try {
			fallbackResults = await performRegexSearch(context, query, activeTechnology.title, maxResults);
		} catch (error) {
			console.warn(`Regex search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
		}
	}

	// If all advanced searches fail, try the original simple search
	if (fallbackResults.length === 0) {
		try {
			const simpleResults = await client.searchFramework(activeTechnology.title, query, {maxResults, platform, symbolType});
			fallbackResults = simpleResults.map(result => ({
				...result,
				foundVia: 'direct' as const,
			}));
		} catch (error) {
			console.warn(`Simple fallback search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
		}
	}

	return fallbackResults;
};
