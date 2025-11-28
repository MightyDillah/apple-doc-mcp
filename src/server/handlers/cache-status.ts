import {readdirSync, statSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ToolResponse} from '../context.js';
import {header, bold} from '../markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cacheDir = join(__dirname, '../../../.cache');

// Format bytes to human readable size
const formatBytes = (bytes: number): string => {
	if (bytes === 0) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / (1024 ** i);
	return `${size.toFixed(1)} ${units[i]}`;
};

export const buildCacheStatusHandler = () => async (): Promise<ToolResponse> => {
	const lines: string[] = [
		header(1, '📦 Cache Status'),
		'',
		bold('Location', cacheDir),
		'',
	];

	if (!existsSync(cacheDir)) {
		lines.push(
			'⚠️ **Cache directory does not exist yet.**',
			'',
			'The cache will be created when you first access a technology.',
			'',
		);
		return {content: [{type: 'text', text: lines.join('\n')}]};
	}

	try {
		const files = readdirSync(cacheDir).filter(f => f.endsWith('.json'));
		let totalSize = 0;
		const frameworks: string[] = [];
		const symbols: string[] = [];

		for (const file of files) {
			const filePath = join(cacheDir, file);
			const stats = statSync(filePath);
			totalSize += stats.size;

			if (file === 'technologies.json') {
				// Skip technologies cache in categorization
			} else if (file.includes('__')) {
				// Symbol files have __ in the name (path separator replacement)
				symbols.push(file.replace('.json', '').replaceAll('__', '/'));
			} else {
				// Framework files
				frameworks.push(file.replace('.json', ''));
			}
		}

		lines.push(
			header(2, 'Statistics'),
			bold('Total Files', files.length.toString()),
			bold('Cache Size', formatBytes(totalSize)),
			bold('Frameworks Cached', frameworks.length.toString()),
			bold('Symbols Cached', symbols.length.toString()),
			'',
		);

		if (frameworks.length > 0) {
			lines.push(
				header(2, 'Cached Frameworks'),
				...frameworks.slice(0, 15).map(f => `• ${f}`),
			);
			if (frameworks.length > 15) {
				lines.push(`*... and ${frameworks.length - 15} more*`);
			}

			lines.push('');
		}

		lines.push(
			header(2, 'Actions'),
			'• To refresh a specific framework: select it with `choose_technology` and search again',
			'• Cache is automatically updated when fetching new documentation',
			'',
		);
	} catch (error) {
		lines.push(
			'❌ **Error reading cache:**',
			error instanceof Error ? error.message : String(error),
		);
	}

	return {content: [{type: 'text', text: lines.join('\n')}]};
};
