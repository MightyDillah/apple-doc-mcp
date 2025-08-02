export interface Technology {
    title: string;
    abstract: {
        text: string;
        type: string;
    }[];
    url: string;
    kind: string;
    role: string;
    identifier: string;
}
export interface ContainerTechnology {
    title: string;
    abstract: {
        text: string;
        type: string;
    }[];
    url: string;
    kind: string;
    role: string;
    identifier: string;
}
export interface ContainerizationTechnology {
    title: string;
    abstract: {
        text: string;
        type: string;
    }[];
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
export interface FrameworkData {
    metadata: {
        title: string;
        role: string;
        platforms: any[];
    };
    abstract: {
        text: string;
        type: string;
    }[];
    topicSections: TopicSection[];
    references: Record<string, any>;
}
export interface SymbolData {
    metadata: {
        title: string;
        symbolKind: string;
        platforms: any[];
    };
    abstract: {
        text: string;
        type: string;
    }[];
    primaryContentSections: any[];
    topicSections: TopicSection[];
    references: Record<string, any>;
}
export interface SearchResult {
    title: string;
    description: string;
    path: string;
    framework: string;
    symbolKind?: string;
    platforms?: string;
}
export declare class AppleDevDocsClient {
    private cache;
    private readonly cacheTimeout;
    private makeRequest;
    getTechnologies(): Promise<Record<string, Technology>>;
    getContainerTechnologies(): Promise<Record<string, ContainerTechnology>>;
    getContainerizationTechnologies(): Promise<Record<string, ContainerizationTechnology>>;
    getFramework(frameworkName: string): Promise<FrameworkData>;
    getContainerFramework(frameworkName: string): Promise<FrameworkData>;
    getContainerizationFramework(frameworkName: string): Promise<FrameworkData>;
    getSymbol(path: string): Promise<SymbolData>;
    getContainerSymbol(path: string): Promise<SymbolData>;
    getContainerizationSymbol(path: string): Promise<SymbolData>;
    searchGlobal(query: string, options?: {
        symbolType?: string;
        platform?: string;
        maxResults?: number;
    }): Promise<SearchResult[]>;
    searchFramework(frameworkName: string, query: string, options?: {
        symbolType?: string;
        platform?: string;
        maxResults?: number;
    }): Promise<SearchResult[]>;
    searchContainerFramework(frameworkName: string, query: string, options?: {
        symbolType?: string;
        platform?: string;
        maxResults?: number;
    }): Promise<SearchResult[]>;
    searchContainerizationFramework(frameworkName: string, query: string, options?: {
        symbolType?: string;
        platform?: string;
        maxResults?: number;
    }): Promise<SearchResult[]>;
    private createSearchPattern;
    private matchesSearch;
    private scoreMatch;
    extractText(abstract: {
        text: string;
        type: string;
    }[]): string;
    formatPlatforms(platforms: any[]): string;
}
