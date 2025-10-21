import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AppleDevDocsClient } from '../apple-client.js';
import { ServerState } from './state.js';
import { registerTools } from './tools.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
export const createServer = () => {
    const server = new Server({
        name: 'apple-dev-docs-mcp',
        version: packageJson.version,
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