import type { FrameworkData, ReferenceData, Technology } from '../apple-client.js';
export type LastDiscovery = {
    query?: string;
    results: Technology[];
};
export type FrameworkIndexEntry = {
    id: string;
    ref: ReferenceData;
    tokens: string[];
};
export declare class ServerState {
    private activeTechnology?;
    private activeFrameworkData?;
    private frameworkIndex?;
    private readonly expandedIdentifiers;
    private lastDiscovery?;
    getActiveTechnology(): Technology | undefined;
    setActiveTechnology(technology: Technology | undefined): void;
    getActiveFrameworkData(): FrameworkData | undefined;
    setActiveFrameworkData(data: FrameworkData | undefined): void;
    clearActiveFrameworkData(): void;
    getFrameworkIndex(): Map<string, FrameworkIndexEntry> | undefined;
    setFrameworkIndex(index: Map<string, FrameworkIndexEntry> | undefined): void;
    clearFrameworkIndex(): void;
    hasExpandedIdentifier(identifier: string): boolean;
    markIdentifierExpanded(identifier: string): void;
    getLastDiscovery(): LastDiscovery | undefined;
    setLastDiscovery(lastDiscovery: LastDiscovery | undefined): void;
}
