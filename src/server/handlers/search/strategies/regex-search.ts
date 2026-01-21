import type {ServerContext} from '../../../context.js';
import {loadActiveFrameworkData} from '../../../services/framework-loader.js';
import type {HierarchicalSearchResult} from '../types.js';

type ScoredResult = HierarchicalSearchResult & {score: number};

type ScoreInput = {
	title: string;
	url: string;
	abstractText: string;
	queryLower: string;
	queryTokens: string[];
};

/**
 * Tokenize a query string, handling camelCase and common delimiters
 */
const tokenizeQuery = (query: string): string[] => {
	const tokens = new Set<string>();
	tokens.add(query.toLowerCase());

	// Split on common delimiters
	const basicParts = query.split(/[\s/._-]+/).filter(Boolean);
	for (const part of basicParts) {
		tokens.add(part.toLowerCase());

		// Handle camelCase
		const camelParts = part.split(/(?=[A-Z])/).filter(Boolean);
		if (camelParts.length > 1) {
			for (const camelPart of camelParts) {
				tokens.add(camelPart.toLowerCase());
			}
		}
	}

	return [...tokens].filter(t => t.length >= 2);
};

/**
 * Calculate relevance score for a reference based on query matching
 * Uses tiered scoring similar to LocalSymbolIndex
 */
const calculateScore = (input: ScoreInput): number => {
	const {title, url, abstractText, queryLower, queryTokens} = input;
	const titleLower = title.toLowerCase();
	const urlLower = url.toLowerCase();
	const abstractLower = abstractText.toLowerCase();

	// Tier 1 (1000): Exact title match
	if (titleLower === queryLower) {
		return 1000;
	}

	// Tier 2 (500): Title starts with query
	if (titleLower.startsWith(queryLower)) {
		return 500;
	}

	// Tier 3 (200): Query matches at camelCase boundary
	const titleParts = title.split(/(?=[A-Z])/);
	for (let i = 0; i < titleParts.length; i++) {
		const suffix = titleParts.slice(i).join('').toLowerCase();
		if (suffix.startsWith(queryLower)) {
			return 200;
		}
	}

	// Tier 4 (100): Title contains query as substring
	if (titleLower.includes(queryLower)) {
		return 100;
	}

	// Tier 5: Token-based matching
	let tokenScore = 0;
	for (const token of queryTokens) {
		if (titleLower.includes(token)) {
			tokenScore += 30;
		} else if (urlLower.includes(token)) {
			tokenScore += 15;
		} else if (abstractLower.includes(token)) {
			tokenScore += 5;
		}
	}

	return tokenScore;
};

export const performRegexSearch = async (
	context: ServerContext,
	query: string,
	frameworkName: string,
	maxResults: number,
): Promise<HierarchicalSearchResult[]> => {
	const {client} = context;
	const scoredResults: ScoredResult[] = [];

	try {
		const framework = await loadActiveFrameworkData(context);
		const queryLower = query.toLowerCase();
		const queryTokens = tokenizeQuery(query);

		for (const ref of Object.values(framework.references)) {
			const title = ref.title ?? '';
			const url = ref.url ?? '';
			const abstractText = client.extractText(ref.abstract ?? []);

			const score = calculateScore({
				title,
				url,
				abstractText,
				queryLower,
				queryTokens,
			});

			if (score > 0) {
				scoredResults.push({
					title: ref.title ?? 'Symbol',
					framework: frameworkName,
					path: ref.url,
					description: abstractText,
					kind: ref.kind,
					platforms: client.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
					foundVia: 'regex',
					score,
				});
			}
		}
	} catch (error) {
		console.warn(`Regex search failed for ${frameworkName}:`, error instanceof Error ? error.message : String(error));
	}

	// Sort by score and return top results (without score property)
	return scoredResults
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults)
		.map(({score, ...result}) => result);
};
