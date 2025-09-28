import type { FrameworkData, SymbolData, Technology, SearchResult } from './apple-client/types/index.js';
export type { PlatformInfo, FrameworkData, SearchResult, SymbolData, Technology, TopicSection, ReferenceData, } from './apple-client/types/index.js';
export declare class AppleDevDocsClient {
    extractText: (abstract?: Array<{
        text: string;
        type: string;
    }>) => string;
    formatPlatforms: (platforms: import("./apple-client/types/index.js").PlatformInfo[]) => string;
    private readonly httpClient;
    private readonly fileCache;
    constructor();
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
}
