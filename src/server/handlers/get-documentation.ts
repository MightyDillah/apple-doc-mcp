import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext, ToolResponse} from '../context.js';
import type {SymbolData, ReferenceData} from '../../apple-client.js';
import {bold, header, trimWithEllipsis} from '../markdown.js';
import {loadActiveFrameworkData} from '../services/framework-loader.js';
import {buildNoTechnologyMessage} from './no-technology.js';

const formatIdentifiers = (identifiers: string[], references: Record<string, ReferenceData> | undefined, client: ServerContext['client']): string[] => {
	const content: string[] = [];

	for (const id of identifiers.slice(0, 5)) {
		const ref = references?.[id];
		if (ref) {
			const refDesc = client.extractText(ref.abstract ?? []);
			content.push(`• **${ref.title}** - ${trimWithEllipsis(refDesc, 100)}`);
		}
	}

	if (identifiers.length > 5) {
		content.push(`*... and ${identifiers.length - 5} more items*`);
	}

	return content;
};

const formatTopicSections = (data: SymbolData, client: ServerContext['client']): string[] => {
	const content: string[] = [];

	if (data.topicSections?.length) {
		content.push('', header(2, 'API Reference'), '');
		for (const section of data.topicSections) {
			content.push(`### ${section.title}`);
			if (section.identifiers?.length) {
				content.push(...formatIdentifiers(section.identifiers, data.references, client));
			}

			content.push('');
		}
	}

	return content;
};

export const buildGetDocumentationHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async ({path}: {path: string}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return await noTechnology();
		}

		const framework = await loadActiveFrameworkData(context);
		const identifierParts = activeTechnology.identifier.split('/');
		const frameworkName = identifierParts.at(-1);

		// Try path as-is first, fallback to framework-prefixed path
		let targetPath = path;
		let data: SymbolData;

		try {
			// First attempt: try the path exactly as provided
			data = await client.getSymbol(targetPath);
		} catch (error) {
			// If that fails and path doesn't already start with documentation/, 
			// try prefixing with framework path
			if (!path.startsWith('documentation/')) {
				try {
					targetPath = `documentation/${frameworkName}/${path}`;
					data = await client.getSymbol(targetPath);
				} catch (secondError) {
					// If both attempts fail, throw the original error with helpful context
					throw new McpError(
						ErrorCode.InvalidRequest,
						`Failed to load documentation for both "${path}" and "${targetPath}": ${error instanceof Error ? error.message : String(error)}`
					);
				}
			} else {
				// Path already starts with documentation/, so just rethrow original error
				throw error;
			}
		}

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

		content.push(...formatTopicSections(data, client));

		return {
			content: [{text: content.join('\n'), type: 'text'}],
		};
	};
};

