import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header, trimWithEllipsis} from '../markdown.js';
import {loadActiveFrameworkData} from '../services/framework-loader.js';
import {buildNoTechnologyMessage} from './no-technology.js';

export const buildGetDocumentationHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async ({path}: {path: string}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const framework = await loadActiveFrameworkData(context);
		const identifierParts = activeTechnology.identifier.split('/');
		const frameworkName = identifierParts[identifierParts.length - 1];

		let targetPath = path;
		if (!path.startsWith('documentation/')) {
			targetPath = `documentation/${frameworkName}/${path}`;
		}

		try {
			const data = await client.getSymbol(targetPath);

			const title = data.metadata?.title || 'Symbol';
			const kind = data.metadata?.symbolKind || 'Unknown';
			const platforms = client.formatPlatforms(data.metadata?.platforms ?? framework.metadata.platforms);
			const description = client.extractText(data.abstract);

			const content: string[] = [
				header(1, title),
				'',
				bold('Technology', activeTechnology.title),
				bold('Type', kind),
				bold('Platforms', platforms),
				'',
				header(2, 'Overview'),
				description,
			];

			if (data.topicSections?.length) {
				content.push('', header(2, 'API Reference'), '');
				for (const section of data.topicSections) {
					content.push(`### ${section.title}`);
					if (section.identifiers?.length) {
						for (const id of section.identifiers.slice(0, 5)) {
							const ref = data.references?.[id];
							if (ref) {
								const refDesc = client.extractText(ref.abstract ?? []);
								content.push(`• **${ref.title}** - ${trimWithEllipsis(refDesc, 100)}`);
							}
						}
						if (section.identifiers.length > 5) {
							content.push(`*... and ${section.identifiers.length - 5} more items*`);
						}
					}
					content.push('');
				}
			}

			return {
				content: [{text: content.join('\n'), type: 'text'}],
			};
		} catch (error) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				`Failed to load documentation for ${targetPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};
};

