export type PlatformInfo = {
	name: string;
	introducedAt: string;
	beta?: boolean;
};

export type FrameworkData = {
	abstract: Array<{text: string; type: string}>;
	metadata: {
		platforms: PlatformInfo[];
		role: string;
		title: string;
	};
	references: Record<string, ReferenceData>;
	topicSections: TopicSection[];
};

export type SearchResult = {
	description: string;
	framework: string;
	path: string;
	platforms?: string;
	symbolKind?: string;
	title: string;
};

export type SymbolData = {
	abstract: Array<{text: string; type: string}>;
	metadata: {
		platforms: PlatformInfo[];
		symbolKind: string;
		title: string;
	};
	primaryContentSections: any[];
	references: Record<string, ReferenceData>;
	topicSections: TopicSection[];
};

export type Technology = {
	abstract: Array<{text: string; type: string}>;
	identifier: string;
	kind: string;
	role: string;
	title: string;
	url: string;
};

export type TopicSection = {
	anchor?: string;
	identifiers: string[];
	title: string;
};

export type ReferenceData = {
	title: string;
	kind?: string;
	abstract?: Array<{text: string; type: string}>;
	platforms?: PlatformInfo[];
	url: string;
};

export type CacheEntry<T> = {
	data: T;
	timestamp: number;
};
