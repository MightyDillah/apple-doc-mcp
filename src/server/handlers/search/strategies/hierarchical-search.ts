import type {ServerContext} from '../../../context.js';
import type {ReferenceData, FrameworkData, PlatformInfo} from '../../../../apple-client.js';
import {loadActiveFrameworkData, expandSymbolReferences} from '../../../services/framework-loader.js';
import type {HierarchicalSearchResult} from '../types.js';

type CreateSearchResultOptions = {
	framework: FrameworkData;
	foundVia: 'direct' | 'hierarchical' | 'regex';
};

type ProcessExpandedIndexesOptions = {
	lowerQuery: string;
	client: ServerContext['client'];
	frameworkName: string;
	maxResults: number;
	results: HierarchicalSearchResult[];
};

const createSearchResult = (
	ref: ReferenceData,
	frameworkName: string,
	client: ServerContext['client'],
	options: CreateSearchResultOptions,
): HierarchicalSearchResult => {
	const abstractText = client.extractText(ref.abstract ?? []);
	const platforms: PlatformInfo[] = ref.platforms ?? options.framework.metadata.platforms;
	return {
		title: ref.title ?? 'Symbol',
		framework: frameworkName,
		path: ref.url,
		description: abstractText,
		kind: ref.kind,
		platforms: client.formatPlatforms(platforms),
		foundVia: options.foundVia,
	};
};

const checkReferenceMatch = (
	ref: ReferenceData,
	lowerQuery: string,
	client: ServerContext['client'],
): {matches: boolean; foundVia: 'direct' | 'hierarchical'} => {
	const title = ref.title ?? '';
	const url = ref.url ?? '';
	const abstractText = client.extractText(ref.abstract ?? []);

	const pathParts = url.toLowerCase().split('/');
	const titleMatch = title.toLowerCase().includes(lowerQuery);
	const pathMatch = pathParts.some(part => part.includes(lowerQuery));
	const abstractMatch = abstractText.toLowerCase().includes(lowerQuery);

	const matches = titleMatch || pathMatch || abstractMatch;
	const foundVia = titleMatch ? 'direct' : 'hierarchical';

	return {matches, foundVia};
};

const processExpandedIndexes = (
	expandedIndexes: Array<Map<string, {ref: ReferenceData}>>,
	options: ProcessExpandedIndexesOptions,
): void => {
	const {lowerQuery, client, frameworkName, maxResults, results} = options;
	for (const expandedIndex of expandedIndexes) {
		if (results.length >= maxResults) {
			break;
		}

		for (const [id, entry] of expandedIndex.entries()) {
			if (results.length >= maxResults) {
				break;
			}

			const title = entry.ref.title ?? '';
			const url = entry.ref.url ?? '';
			const pathParts = url.toLowerCase().split('/');

			if (title.toLowerCase().includes(lowerQuery)
				|| pathParts.some((part: string) => part.includes(lowerQuery))) {
				const abstractText = client.extractText(entry.ref.abstract ?? []);
				const platforms: PlatformInfo[] = entry.ref.platforms ?? [];
				results.push({
					title: entry.ref.title ?? 'Symbol',
					framework: frameworkName,
					path: entry.ref.url,
					description: abstractText,
					kind: entry.ref.kind,
					platforms: client.formatPlatforms(platforms),
					foundVia: 'hierarchical',
				});
			}
		}
	}
};

export const performHierarchicalSearch = async (
	context: ServerContext,
	query: string,
	frameworkName: string,
	maxResults: number,
): Promise<HierarchicalSearchResult[]> => {
	const {client} = context;
	const results: HierarchicalSearchResult[] = [];
	const lowerQuery = query.toLowerCase();

	try {
		const framework = await loadActiveFrameworkData(context);

		// Search through all references with path-based matching
		for (const [id, ref] of Object.entries(framework.references)) {
			if (results.length >= maxResults) {
				break;
			}

			const {matches, foundVia} = checkReferenceMatch(ref, lowerQuery, client);

			if (matches) {
				results.push(createSearchResult(ref, frameworkName, client, {framework, foundVia}));
			}
		}

		// If still no results, try expanding more identifiers
		if (results.length === 0) {
			const allIdentifiers = framework.topicSections.flatMap(section => section.identifiers ?? []);
			const batchSize = 50; // Process in batches to avoid overwhelming the API
			const batches: string[][] = [];

			for (let i = 0; i < allIdentifiers.length; i += batchSize) {
				batches.push(allIdentifiers.slice(i, i + batchSize));
			}

			// Process batches in parallel to avoid await in loop
			const expandPromises = batches.map(async batch => expandSymbolReferences(context, batch));
			const expandedIndexes = await Promise.all(expandPromises);

			processExpandedIndexes(expandedIndexes, {
				lowerQuery, client, frameworkName, maxResults, results,
			});
		}
	} catch (error) {
		console.warn(`Hierarchical search failed for ${frameworkName}:`, error instanceof Error ? error.message : String(error));
	}

	return results;
};
