import type {FrameworkIndexEntry} from '../../state.js';
import type {ReferenceData} from '../../../apple-client.js';
import type {RankedReference, SearchFilters} from './types.js';

export const scoreEntry = (entry: {tokens: string[]; ref: ReferenceData}, terms: string[]): number => {
	let score = 0;
	for (const term of terms) {
		if (entry.tokens.includes(term)) {
			score += 3;
		} else if (entry.tokens.some(token => token.includes(term))) {
			score += 1;
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
