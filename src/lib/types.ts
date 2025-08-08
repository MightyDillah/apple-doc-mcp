export interface AbstractItem {
  text: string;
  type: string;
}

export interface Platform {
  name: string;
  introducedAt: string;
  beta?: boolean;
}

export interface Technology {
  title: string;
  abstract: AbstractItem[];
  url: string;
  kind: string;
  role: string;
  identifier: string;
}

export interface TopicSection {
  title: string;
  identifiers: string[];
  anchor?: string;
}

interface BaseMetadata {
  title: string;
  platforms: Platform[];
}

export interface FrameworkMetadata extends BaseMetadata {
  role: string;
}

export interface SymbolMetadata extends BaseMetadata {
  symbolKind: string;
}

interface BaseDocumentData {
  abstract: AbstractItem[];
  topicSections: TopicSection[];
  references: Record<string, Technology>;
}

export interface FrameworkData extends BaseDocumentData {
  metadata: FrameworkMetadata;
}

export interface SymbolData extends BaseDocumentData {
  metadata: SymbolMetadata;
  primaryContentSections: unknown[];
}

export interface SearchResult {
  title: string;
  description: string;
  path: string;
  framework: string;
  symbolKind?: string;
  platforms?: string;
}

export interface SearchOptions {
  symbolType?: string;
  platform?: string;
  maxResults?: number;
}

export interface ApiResponse<T> {
  references?: Record<string, T>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
