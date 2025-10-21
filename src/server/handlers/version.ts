import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '../../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

export const buildVersionHandler = () => {
	return async () => {
		return {
			content: [
				{
					type: 'text' as const,
					text: `Apple Doc MCP Server Version Information:

📦 Package Version: ${packageJson.version}
🏷️  Server Name: ${packageJson.name}
📝 Description: ${packageJson.description}
👤 Author: ${packageJson.author}
🔗 Repository: ${packageJson.repository?.url || 'N/A'}

The server version now dynamically reads from package.json instead of being hardcoded.`,
				},
			],
		};
	};
};
