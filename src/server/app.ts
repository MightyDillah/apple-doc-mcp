import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {AppleDevDocsClient} from '../apple-client.js';
import {ServerState} from './state.js';
import {registerTools} from './tools.js';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

export const createServer = () => {
	const server = new Server(
		{
			name: 'apple-dev-docs-mcp',
			version: packageJson.version,
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	const client = new AppleDevDocsClient();
	const state = new ServerState();

	registerTools(server, {client, state});

	return server;
};

