import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
	type AppleDevDocsClient, type SymbolData, type ReferenceData, type FrameworkData,
} from '../../apple-client.js';
import {tokenize, createSearchTokens} from '../utils/tokenizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type LocalSymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
};

export class LocalSymbolIndex {
	private readonly symbols = new Map<string, LocalSymbolIndexEntry>();
	private readonly cacheDir: string;
	private readonly technologyIdentifier?: string;
	private indexBuilt = false;

	constructor(private readonly client: AppleDevDocsClient, technologyIdentifier?: string) {
		this.cacheDir = join(__dirname, '../../../.cache');
		this.technologyIdentifier = technologyIdentifier;
	}

	async buildIndexFromCache(): Promise<void> {
		if (this.indexBuilt) {
			console.error('📚 Index already built, skipping rebuild');
			return;
		}

		console.error('📚 Building local symbol index from cached files...');

		// Validate cache directory exists
		if (!existsSync(this.cacheDir)) {
			console.warn(`Cache directory does not exist: ${this.cacheDir}`);
			this.indexBuilt = true;
			return;
		}

		// Read all JSON files in the docs directory
		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		console.error(`📁 Found ${files.length} cached files`);

		let processedCount = 0;
		let errorCount = 0;

		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			try {
				const rawData = readFileSync(filePath, 'utf8');
				const data = JSON.parse(rawData) as SymbolData | FrameworkData;

				// Validate data structure
				if (!this.isValidCacheData(data)) {
					console.warn(`Invalid cache data in ${file}, skipping`);
					errorCount++;
					continue;
				}

				// Process the data
				this.processSymbolData(data, filePath);
				processedCount++;
			} catch (error) {
				console.warn(`Failed to process ${file}:`, error instanceof Error ? error.message : String(error));
				errorCount++;
			}
		}

		this.indexBuilt = true;
		console.error(`✅ Local symbol index built with ${this.symbols.size} symbols (${processedCount} files processed, ${errorCount} errors)`);
	}

	search(query: string, maxResults = 20): LocalSymbolIndexEntry[] {
		const results: Array<{entry: LocalSymbolIndexEntry; score: number}> = [];
		const queryTokens = tokenize(query);

		// Check if query contains wildcards
		const hasWildcards = query.includes('*') || query.includes('?');

		for (const [id, entry] of this.symbols.entries()) {
			let score = 0;

			if (hasWildcards) {
				// Wildcard matching
				const pattern = query
					.replaceAll('*', '.*')
					.replaceAll('?', '.')
					.toLowerCase();

				const regex = new RegExp(`^${pattern}$`);

				if (regex.test(entry.title.toLowerCase())
					|| regex.test(entry.path.toLowerCase())
					|| entry.tokens.some(token => regex.test(token))) {
					score = 100; // High score for wildcard matches
				}
			} else {
				// Regular token-based matching
				for (const queryToken of queryTokens) {
					if (entry.title.toLowerCase().includes(queryToken.toLowerCase())) {
						score += 50;
					}

					if (entry.tokens.includes(queryToken)) {
						score += 30;
					}

					if (entry.abstract.toLowerCase().includes(queryToken.toLowerCase())) {
						score += 10;
					}
				}
			}

			if (score > 0) {
				results.push({entry, score});
			}
		}

		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, maxResults)
			.map(result => result.entry);
	}

	getSymbolCount(): number {
		return this.symbols.size;
	}

	clear(): void {
		this.symbols.clear();
		this.indexBuilt = false;
	}

	private isValidCacheData(data: unknown): data is SymbolData | FrameworkData {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const object = data as Record<string, unknown>;

		// Check for required properties
		if (!('abstract' in object) || !('metadata' in object)) {
			return false;
		}

		// Validate metadata structure
		const {metadata} = object;
		if (!metadata || typeof metadata !== 'object') {
			return false;
		}

		return true;
	}

	private processSymbolData(data: SymbolData | FrameworkData, filePath: string): void {
		const title = data.metadata?.title || 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) || [];

		// Filter by technology if specified
		if (this.technologyIdentifier && path) {
			const technologyPath = this.technologyIdentifier.toLowerCase();
			const symbolPath = path.toLowerCase();
			if (!symbolPath.includes(technologyPath)) {
				return; // Skip symbols not from the selected technology
			}
		}

		// Create comprehensive tokens
		const tokens = createSearchTokens(title, abstract, path, platforms);

		const entry: LocalSymbolIndexEntry = {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens,
			filePath,
		};

		this.symbols.set(path || title, entry);

		// Process references recursively
		this.processReferences(data.references, filePath);
	}

	private processReferences(references: Record<string, ReferenceData> | undefined, filePath: string): void {
		if (!references) {
			return;
		}

		for (const [refId, ref] of Object.entries(references)) {
			if (ref.kind === 'symbol' && ref.title) {
				// Filter references by technology if specified
				if (this.technologyIdentifier && ref.url) {
					const technologyPath = this.technologyIdentifier.toLowerCase();
					const refPath = ref.url.toLowerCase();
					if (!refPath.includes(technologyPath)) {
						continue; // Skip references not from the selected technology
					}
				}

				const refTokens = createSearchTokens(
					ref.title,
					this.client.extractText(ref.abstract ?? []),
					ref.url || '',
					ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
				);

				const refEntry: LocalSymbolIndexEntry = {
					id: refId,
					title: ref.title,
					path: ref.url || '',
					kind: ref.kind,
					abstract: this.client.extractText(ref.abstract ?? []),
					platforms: ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
					tokens: refTokens,
					filePath,
				};

				this.symbols.set(refId, refEntry);
			}
		}
	}
}
