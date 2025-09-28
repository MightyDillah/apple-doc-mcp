import type {ReferenceData} from '../../../apple-client.js';

export type RankedReference = {
	id: string;
	ref: ReferenceData;
	score: number;
};

export type HierarchicalSearchResult = {
	title: string;
	path: string;
	description?: string;
	framework: string;
	kind?: string;
	platforms?: string;
	foundVia: 'direct' | 'hierarchical' | 'regex';
};

export type SearchFilters = {
	symbolType?: string;
	platform?: string;
};
