import type {ServerContext} from '../context.js';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {SymbolData, ReferenceData, FrameworkData} from '../../apple-client.js';
import {AppleDevDocsClient} from '../../apple-client.js';

export interface SymbolIndexEntry {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
}

export class ComprehensiveSymbolIndex {
	private symbols: Map<string, SymbolIndexEntry> = new Map();
	private client: AppleDevDocsClient;

	constructor(client: AppleDevDocsClient) {
		this.client = client;
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

	private processSymbolData(data: SymbolData | FrameworkData, frameworkName: string): void {
		const title = data.metadata?.title || 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) || [];
		
		// Create comprehensive tokens
		const tokens = new Set<string>();
		this.tokenize(title).forEach(token => tokens.add(token));
		this.tokenize(abstract).forEach(token => tokens.add(token));
		this.tokenize(path).forEach(token => tokens.add(token));
		
		// Add platform tokens
		platforms.forEach(platform => {
			this.tokenize(platform).forEach(token => tokens.add(token));
		});

		const entry: SymbolIndexEntry = {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens: [...tokens]
		};

		this.symbols.set(path || title, entry);

		// Process references recursively
		if (data.references) {
			for (const [refId, ref] of Object.entries(data.references)) {
				if (ref.kind === 'symbol' && ref.title) {
					const refTokens = new Set<string>();
					this.tokenize(ref.title).forEach(token => refTokens.add(token));
					this.tokenize(ref.url || '').forEach(token => refTokens.add(token));
					this.tokenize(this.client.extractText(ref.abstract || [])).forEach(token => refTokens.add(token));

					const refEntry: SymbolIndexEntry = {
						id: refId,
						title: ref.title,
						path: ref.url || '',
						kind: ref.kind,
						abstract: this.client.extractText(ref.abstract || []),
						platforms: ref.platforms?.map(p => p.name).filter(Boolean) || [],
						tokens: [...refTokens]
					};

					this.symbols.set(refId, refEntry);
				}
			}
		}
	}

	async buildIndex(context: ServerContext): Promise<void> {
		const {state} = context;
		const activeTechnology = state.getActiveTechnology();
		
		if (!activeTechnology) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				'No technology selected. Use `discover_technologies` then `choose_technology` first.'
			);
		}

		// Load framework data
		const frameworkData = await this.client.getFramework(activeTechnology.title);
		this.processSymbolData(frameworkData, activeTechnology.title);

		// Load all topic sections and their identifiers
		const allIdentifiers = frameworkData.topicSections.flatMap(section => section.identifiers ?? []);
		
		// Process identifiers in batches to avoid overwhelming the API
		const batchSize = 20;
		for (let i = 0; i < allIdentifiers.length; i += batchSize) {
			const batch = allIdentifiers.slice(i, i + batchSize);
			
			const promises = batch.map(async identifier => {
				try {
					const symbolPath = identifier
						.replace('doc://com.apple.documentation/', '')
						.replace(/^documentation\//, 'documentation/');
					
					const data = await this.client.getSymbol(symbolPath);
					this.processSymbolData(data, activeTechnology.title);
				} catch (error) {
					console.warn(`Failed to load symbol ${identifier}:`, error instanceof Error ? error.message : String(error));
				}
			});

			await Promise.all(promises);
		}
	}

	search(query: string, maxResults: number = 20): SymbolIndexEntry[] {
		const results: Array<{entry: SymbolIndexEntry; score: number}> = [];
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
