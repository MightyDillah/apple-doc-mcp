import type { FrameworkData, ReferenceData } from '../../apple-client.js';
import type { ServerContext } from '../context.js';
export declare const loadActiveFrameworkData: ({ client, state }: ServerContext) => Promise<FrameworkData>;
export declare const ensureFrameworkIndex: (context: ServerContext) => Promise<Map<string, import("../state.js").FrameworkIndexEntry>>;
export declare const expandSymbolReferences: (context: ServerContext, identifiers: string[]) => Promise<Map<string, {
    id: string;
    ref: ReferenceData;
    tokens: string[];
}>>;
export declare const getFrameworkIndexEntries: (context: ServerContext) => Promise<import("../state.js").FrameworkIndexEntry[]>;
