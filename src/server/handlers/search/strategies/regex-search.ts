import type {ServerContext} from '../../../context.js';
import {loadActiveFrameworkData} from '../../../services/framework-loader.js';
import type {HierarchicalSearchResult} from '../types.js';

export const performRegexSearch = async (
	context: ServerContext,
	query: string,
	frameworkName: string,
	maxResults: number,
): Promise<HierarchicalSearchResult[]> => {
	const {client} = context;
	const results: HierarchicalSearchResult[] = [];

	try {
		const framework = await loadActiveFrameworkData(context);

		// Create fuzzy regex pattern from query
		const escapedQuery = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const fuzzyPattern = [...escapedQuery].join('.*?');
		const regex = new RegExp(fuzzyPattern, 'i');

		for (const [id, ref] of Object.entries(framework.references)) {
			if (results.length >= maxResults) {
				break;
			}

			const title = ref.title ?? '';
			const url = ref.url ?? '';
			const abstractText = client.extractText(ref.abstract ?? []);

			if (regex.test(title) || regex.test(url) || regex.test(abstractText)) {
				results.push({
					title: ref.title ?? 'Symbol',
					framework: frameworkName,
					path: ref.url,
					description: abstractText,
					kind: ref.kind,
					platforms: client.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
					foundVia: 'regex',
				});
			}
		}
	} catch (error) {
		console.warn(`Regex search failed for ${frameworkName}:`, error instanceof Error ? error.message : String(error));
	}

	return results;
};
