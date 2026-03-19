import type { ServerContext, ToolResponse } from '../context.js';
import type { SymbolData, ReferenceData } from '../../apple-client.js';
import { bold, header, trimWithEllipsis } from '../markdown.js';
import { loadActiveFrameworkData } from '../services/framework-loader.js';
import { resolveSymbol } from '../services/symbol-resolution.js';
import { buildNoTechnologyMessage } from './no-technology.js';

const formatIdentifiers = (
	identifiers: string[],
	references: Record<string, ReferenceData> | undefined,
	client: ServerContext['client'],
): string[] => {
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

const formatTopicSections = (
	data: SymbolData,
	client: ServerContext['client'],
): string[] => {
	const content: string[] = [];

	if (data.topicSections?.length) {
		content.push('', header(2, 'API Reference'), '');
		for (const section of data.topicSections) {
			content.push(`### ${section.title}`);
			if (section.identifiers?.length) {
				content.push(
					...formatIdentifiers(section.identifiers, data.references, client),
				);
			}

			content.push('');
		}
	}

	return content;
};

export const buildGetDocumentationHandler = (context: ServerContext) => {
	const { client, state } = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async ({ path }: { path: string }): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const framework = await loadActiveFrameworkData(context);
		const { data }: { data: SymbolData; targetPath: string } =
			await resolveSymbol(client, activeTechnology, path);

		const title = data.metadata?.title || 'Symbol';
		const kind = data.metadata?.symbolKind || 'Unknown';
		const platforms = client.formatPlatforms(
			data.metadata?.platforms ?? framework.metadata.platforms,
		);
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
			content: [{ text: content.join('\n'), type: 'text' }],
		};
	};
};
