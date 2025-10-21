import type {FrameworkIndexEntry} from '../../state.js';
import type {ReferenceData} from '../../../apple-client.js';
import type {RankedReference, SearchFilters} from './types.js';

export const scoreEntry = (entry: {tokens: string[]; ref: ReferenceData}, terms: string[]): number => {
	let score = 0;

	for (const term of terms) {
		const termLower = term.toLowerCase();

		// Exact match (highest priority)
		if (entry.tokens.includes(term)) {
			score += 5;
			continue;
		}

		// Case-insensitive exact match
		if (entry.tokens.some(token => token.toLowerCase() === termLower)) {
			score += 4;
			continue;
		}

		// Partial match (substring)
		if (entry.tokens.some(token => token.toLowerCase().includes(termLower))) {
			score += 2;
			continue;
		}

		// Fuzzy match for close approximations
		for (const token of entry.tokens) {
			const tokenLower = token.toLowerCase();
			if (tokenLower.length > 2 && termLower.length > 2) {
				// Simple fuzzy: check if term is mostly contained in token
				const commonChars = [...termLower].filter(char => tokenLower.includes(char)).length;
				if (commonChars / termLower.length > 0.7) {
					score += 1;
					break;
				}
			}
		}
	}

	return score;
};

export const collectMatches = (
	entries: FrameworkIndexEntry[],
	query: string,
	maxResults: number,
	filters: SearchFilters,
): RankedReference[] => {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	const ranked: RankedReference[] = [];

	for (const entry of entries) {
		const score = scoreEntry(entry, terms);
		if (score <= 0) {
			continue;
		}

		if (filters.symbolType && entry.ref.kind?.toLowerCase() !== filters.symbolType.toLowerCase()) {
			continue;
		}

		if (filters.platform) {
			const platformLower = filters.platform.toLowerCase();
			if (!entry.ref.platforms?.some(p => p.name?.toLowerCase().includes(platformLower))) {
				continue;
			}
		}

		ranked.push({id: entry.id, ref: entry.ref, score});
	}

	return ranked
		.sort((a, b) => b.score - a.score || (a.ref.title ?? '').localeCompare(b.ref.title ?? ''))
		.slice(0, maxResults);
};
