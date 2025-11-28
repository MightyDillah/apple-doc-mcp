import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AppleDevDocsClient } from '../apple-client.js';
import { ServerState } from './state.js';
import { registerTools } from './tools.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
export const createServer = () => {
    const mcpServer = new McpServer({
        name: 'apple-dev-docs-mcp',
        version: packageJson.version,
    }, {
        capabilities: {
            tools: {},
        },
    });
    const client = new AppleDevDocsClient();
    const state = new ServerState();
    registerTools(mcpServer, { client, state });
    return mcpServer;
};
//# sourceMappingURL=app.js.map