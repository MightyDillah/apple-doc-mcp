import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
	type AppleDevDocsClient, type SymbolData, type ReferenceData, type FrameworkData,
} from '../../apple-client.js';

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
		this.cacheDir = join(__dirname, '../../../cache');
		this.technologyIdentifier = technologyIdentifier;
	}

	async buildIndexFromCache(): Promise<void> {
		if (this.indexBuilt) {
			console.log('📚 Index already built, skipping rebuild');
			return;
		}

		console.log('📚 Building local symbol index from cached files...');

		// Read all JSON files in the docs directory
		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		console.log(`📁 Found ${files.length} cached files`);

		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			try {
				const rawData = readFileSync(filePath, 'utf8');
				const data = JSON.parse(rawData) as SymbolData | FrameworkData;

				// Process the data
				this.processSymbolData(data, filePath);
			} catch (error) {
				console.warn(`Failed to process ${file}:`, error instanceof Error ? error.message : String(error));
			}
		}

		this.indexBuilt = true;
		console.log(`✅ Local symbol index built with ${this.symbols.size} symbols`);
	}

	search(query: string, maxResults = 20): LocalSymbolIndexEntry[] {
		const results: Array<{entry: LocalSymbolIndexEntry; score: number}> = [];
		const queryTokens = this.tokenize(query);

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
	}

	private tokenize(text: string): string[] {
		if (!text) {
			return [];
		}

		const tokens = new Set<string>();

		// Split on common delimiters
		const basicTokens = text.split(/[\s/._-]+/).filter(Boolean);

		for (const token of basicTokens) {
			// Add lowercase version
			tokens.add(token.toLowerCase());

			// Add original case version for exact matches
			tokens.add(token);

			// Handle camelCase/PascalCase (e.g., GridItem -> grid, item, griditem)
			const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
			if (camelParts.length > 1) {
				for (const part of camelParts) {
					tokens.add(part.toLowerCase());
					tokens.add(part);
				}

				// Add concatenated lowercase version
				tokens.add(camelParts.join('').toLowerCase());
			}
		}

		return [...tokens];
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
		const tokens = this.createTokens(title, abstract, path, platforms);

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

	private createTokens(title: string, abstract: string, path: string, platforms: string[]): string[] {
		const tokens = new Set<string>();

		for (const token of this.tokenize(title)) {
			tokens.add(token);
		}

		for (const token of this.tokenize(abstract)) {
			tokens.add(token);
		}

		for (const token of this.tokenize(path)) {
			tokens.add(token);
		}

		// Add platform tokens
		for (const platform of platforms) {
			for (const token of this.tokenize(platform)) {
				tokens.add(token);
			}
		}

		return [...tokens];
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

				const refTokens = this.createTokens(
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
