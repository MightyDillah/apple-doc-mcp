import type { AppleDevDocsClient } from '../apple-client.js';
import type { ServerState } from './state.js';
export type ToolResponse = {
    content: Array<{
        text: string;
        type: 'text';
    }>;
};
export type ServerContext = {
    client: AppleDevDocsClient;
    state: ServerState;
};
