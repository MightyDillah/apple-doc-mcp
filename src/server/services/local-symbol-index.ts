import type {SymbolData, ReferenceData, FrameworkData} from '../../apple-client.js';
import {AppleDevDocsClient} from '../../apple-client.js';
import {readFileSync, existsSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LocalSymbolIndexEntry {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
}

export class LocalSymbolIndex {
	private symbols: Map<string, LocalSymbolIndexEntry> = new Map();
	private client: AppleDevDocsClient;
	private cacheDir: string;
	private technologyIdentifier?: string;

	constructor(client: AppleDevDocsClient, technologyIdentifier?: string) {
		this.client = client;
		this.cacheDir = join(__dirname, '../../../docs');
		this.technologyIdentifier = technologyIdentifier;
	}

	private tokenize(text: string): string[] {
		if (!text) return [];
		
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
		const tokens = new Set<string>();
		this.tokenize(title).forEach(token => tokens.add(token));
		this.tokenize(abstract).forEach(token => tokens.add(token));
		this.tokenize(path).forEach(token => tokens.add(token));
		
		// Add platform tokens
		platforms.forEach(platform => {
			this.tokenize(platform).forEach(token => tokens.add(token));
		});

		const entry: LocalSymbolIndexEntry = {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens: [...tokens],
			filePath
		};

		this.symbols.set(path || title, entry);

		// Process references recursively
		if (data.references) {
			for (const [refId, ref] of Object.entries(data.references)) {
				if (ref.kind === 'symbol' && ref.title) {
					// Filter references by technology if specified
					if (this.technologyIdentifier && ref.url) {
						const technologyPath = this.technologyIdentifier.toLowerCase();
						const refPath = ref.url.toLowerCase();
						if (!refPath.includes(technologyPath)) {
							continue; // Skip references not from the selected technology
						}
					}

					const refTokens = new Set<string>();
					this.tokenize(ref.title).forEach(token => refTokens.add(token));
					this.tokenize(ref.url || '').forEach(token => refTokens.add(token));
					this.tokenize(this.client.extractText(ref.abstract || [])).forEach(token => refTokens.add(token));

					const refEntry: LocalSymbolIndexEntry = {
						id: refId,
						title: ref.title,
						path: ref.url || '',
						kind: ref.kind,
						abstract: this.client.extractText(ref.abstract || []),
						platforms: ref.platforms?.map(p => p.name).filter(Boolean) || [],
						tokens: [...refTokens],
						filePath
					};

					this.symbols.set(refId, refEntry);
				}
			}
		}
	}

	async buildIndexFromCache(): Promise<void> {
		console.log('Building local symbol index from cached files...');
		
		// Read all JSON files in the docs directory
		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		
		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			try {
				const rawData = readFileSync(filePath, 'utf8');
				const data = JSON.parse(rawData);
				
				// Process the data
				this.processSymbolData(data, filePath);
			} catch (error) {
				console.warn(`Failed to process ${file}:`, error instanceof Error ? error.message : String(error));
			}
		}
		
		console.log(`Local symbol index built with ${this.symbols.size} symbols`);
	}

	search(query: string, maxResults: number = 20): LocalSymbolIndexEntry[] {
		const results: Array<{entry: LocalSymbolIndexEntry; score: number}> = [];
		const queryTokens = this.tokenize(query);
		
		// Check if query contains wildcards
		const hasWildcards = query.includes('*') || query.includes('?');
		
		for (const [id, entry] of this.symbols.entries()) {
			let score = 0;
			
			if (hasWildcards) {
				// Wildcard matching
				const pattern = query
					.replace(/\*/g, '.*')
					.replace(/\?/g, '.')
					.toLowerCase();
				
				const regex = new RegExp(`^${pattern}$`);
				
				if (regex.test(entry.title.toLowerCase()) || 
					regex.test(entry.path.toLowerCase()) ||
					entry.tokens.some(token => regex.test(token))) {
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
}
