import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AppleDevDocsClient } from '../apple-client.js';
import { ServerState } from './state.js';
import { registerTools } from './tools.js';
export const createServer = () => {
    const server = new Server({
        name: 'apple-dev-docs-mcp',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    const client = new AppleDevDocsClient();
    const state = new ServerState();
    registerTools(server, { client, state });
    return server;
};
//# sourceMappingURL=app.js.map