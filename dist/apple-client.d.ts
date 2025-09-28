export type PlatformInfo = {
    name: string;
    introducedAt: string;
    beta?: boolean;
};
export type FrameworkData = {
    abstract: Array<{
        text: string;
        type: string;
    }>;
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
    abstract: Array<{
        text: string;
        type: string;
    }>;
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
    abstract: Array<{
        text: string;
        type: string;
    }>;
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
    abstract?: Array<{
        text: string;
        type: string;
    }>;
    platforms?: PlatformInfo[];
    url: string;
};
export declare class AppleDevDocsClient {
    private readonly cache;
    private readonly cacheTimeout;
    private readonly technologiesCachePath;
    private readonly frameworkCacheDir;
    private sanitizeFrameworkName;
    private getFrameworkCachePath;
    private ensureFrameworkCacheDir;
    private loadCachedFramework;
    private saveFrameworkCache;
    extractText(abstract: Array<{
        text: string;
        type: string;
    }>): string;
    private loadCachedTechnologies;
    private saveCachedTechnologies;
    formatPlatforms(platforms: PlatformInfo[]): string;
    getFramework(frameworkName: string): Promise<FrameworkData>;
    refreshFramework(frameworkName: string): Promise<FrameworkData>;
    getSymbol(path: string): Promise<SymbolData>;
    getTechnologies(): Promise<Record<string, Technology>>;
    refreshTechnologies(): Promise<Record<string, Technology>>;
    searchFramework(frameworkName: string, query: string, options?: {
        maxResults?: number;
        platform?: string;
        symbolType?: string;
    }): Promise<SearchResult[]>;
    searchGlobal(query: string, options?: {
        maxResults?: number;
        platform?: string;
        symbolType?: string;
    }): Promise<SearchResult[]>;
    private createSearchPatterns;
    private parseSearchQuery;
    private makeRequest;
    private matchesSearch;
    private scoreMatch;
}
