export type PlatformInfo = {
	name: string;
	introducedAt: string;
	beta?: boolean;
	deprecated?: boolean;
	unavailable?: boolean;
};

// Token types for declarations
export type DeclarationToken = {
	kind: 'keyword' | 'identifier' | 'text' | 'typeIdentifier' | 'attribute' | 'genericParameter' | 'externalParam' | 'internalParam' | 'number' | 'string';
	text: string;
	identifier?: string;
	preciseIdentifier?: string;
};

export type Declaration = {
	languages: string[];
	platforms?: string[];
	tokens: DeclarationToken[];
};

// Content types for primaryContentSections
export type InlineContent = {
	type: 'text' | 'codeVoice' | 'reference' | 'emphasis' | 'strong';
	text?: string;
	code?: string;
	identifier?: string;
	inlineContent?: InlineContent[];
};

export type ContentBlock = {
	type: 'paragraph' | 'heading' | 'codeListing' | 'unorderedList' | 'orderedList' | 'aside';
	inlineContent?: InlineContent[];
	text?: string;
	level?: number;
	anchor?: string;
	syntax?: string;
	code?: string[];
	items?: Array<{content: ContentBlock[]}>;
	style?: string;
	content?: ContentBlock[];
};

export type ParameterContent = {
	name: string;
	content: ContentBlock[];
};

// Primary content section types
export type DeclarationsSection = {
	kind: 'declarations';
	declarations: Declaration[];
};

export type ParametersSection = {
	kind: 'parameters';
	parameters: ParameterContent[];
};

export type ContentSection = {
	kind: 'content';
	content: ContentBlock[];
};

export type MentionsSection = {
	kind: 'mentions';
	mentions: string[];
};

export type PrimaryContentSection =
	| DeclarationsSection
	| ParametersSection
	| ContentSection
	| MentionsSection;

// Metadata fragment for search preview
export type Fragment = {
	kind: 'keyword' | 'identifier' | 'text' | 'typeIdentifier';
	text: string;
	preciseIdentifier?: string;
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
		roleHeading?: string;
		fragments?: Fragment[];
	};
	primaryContentSections: PrimaryContentSection[];
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
