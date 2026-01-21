import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
	type AppleDevDocsClient, type SymbolData, type ReferenceData, type FrameworkData,
} from '../../apple-client.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

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

export type ScoredSearchResult = {
	entry: LocalSymbolIndexEntry;
	score: number;
};

export class LocalSymbolIndex {
	private readonly symbols = new Map<string, LocalSymbolIndexEntry>();
	private readonly cacheDir: string;
	private readonly technologyIdentifier?: string;
	private indexBuilt = false;

	constructor(private readonly client: AppleDevDocsClient, technologyIdentifier?: string) {
		this.cacheDir = join(currentDirname, '../../../.cache');
		this.technologyIdentifier = technologyIdentifier;
	}

	// Public methods first
	async buildIndexFromCache(): Promise<void> {
		if (this.indexBuilt) {
			console.error('📚 Index already built, skipping rebuild');
			return;
		}

		console.error('📚 Building local symbol index from cached files...');

		if (!existsSync(this.cacheDir)) {
			console.warn(`Cache directory does not exist: ${this.cacheDir}`);
			this.indexBuilt = true;
			return;
		}

		const files = readdirSync(this.cacheDir).filter(file => file.endsWith('.json'));
		console.error(`📁 Found ${files.length} cached files`);

		let processedCount = 0;
		let errorCount = 0;

		for (const file of files) {
			const filePath = join(this.cacheDir, file);
			try {
				const rawData = readFileSync(filePath, 'utf8');
				const data = JSON.parse(rawData) as SymbolData | FrameworkData;

				if (!this.isValidCacheData(data)) {
					console.warn(`Invalid cache data in ${file}, skipping`);
					errorCount++;
					continue;
				}

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
		return this.searchWithScores(query, maxResults).map(r => r.entry);
	}

	searchWithScores(query: string, maxResults = 20): ScoredSearchResult[] {
		const results: ScoredSearchResult[] = [];
		const queryLower = query.toLowerCase();
		const queryTokens = this.tokenize(query);
		const hasWildcards = query.includes('*') || query.includes('?');

		for (const entry of this.symbols.values()) {
			const titleLower = entry.title.toLowerCase();
			const score = hasWildcards
				? this.calculateWildcardScore(query, entry, titleLower)
				: this.calculateTieredScore(entry, queryLower, queryTokens);

			if (score > 0) {
				results.push({entry, score});
			}
		}

		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, maxResults);
	}

	getSymbolCount(): number {
		return this.symbols.size;
	}

	isBuilt(): boolean {
		return this.indexBuilt;
	}

	clear(): void {
		this.symbols.clear();
		this.indexBuilt = false;
	}

	rebuildIndex(): void {
		this.indexBuilt = false;
		this.symbols.clear();
	}

	addSymbolFromData(data: SymbolData | FrameworkData, filePath: string): boolean {
		if (!this.isValidCacheData(data)) {
			return false;
		}

		const previousCount = this.symbols.size;
		this.processSymbolData(data, filePath);
		return this.symbols.size > previousCount;
	}

	// Private methods after public methods
	private calculateWildcardScore(query: string, entry: LocalSymbolIndexEntry, titleLower: string): number {
		const pattern = query
			.replaceAll('*', '.*')
			.replaceAll('?', '.')
			.toLowerCase();

		try {
			const regex = new RegExp(`^${pattern}$`);

			if (regex.test(titleLower)) {
				return 500;
			}

			if (regex.test(entry.path.toLowerCase())) {
				return 300;
			}

			if (entry.tokens.some(token => regex.test(token))) {
				return 100;
			}
		} catch {
			// Invalid regex pattern, skip
		}

		return 0;
	}

	private calculateTieredScore(entry: LocalSymbolIndexEntry, queryLower: string, queryTokens: string[]): number {
		const titleLower = entry.title.toLowerCase();
		const pathLower = entry.path.toLowerCase();
		const abstractLower = entry.abstract.toLowerCase();

		if (titleLower === queryLower) {
			return 1000;
		}

		if (titleLower.startsWith(queryLower)) {
			return 500;
		}

		if (this.matchesAtWordBoundary(entry.title, queryLower)) {
			return 200;
		}

		if (titleLower.includes(queryLower)) {
			return 100;
		}

		let tokenScore = 0;

		for (const queryToken of queryTokens) {
			const queryTokenLower = queryToken.toLowerCase();

			if (entry.tokens.some(t => t.toLowerCase() === queryTokenLower)) {
				tokenScore += 30;
			} else if (titleLower.includes(queryTokenLower)) {
				tokenScore += 15;
			} else if (pathLower.includes(queryTokenLower)) {
				tokenScore += 10;
			} else if (abstractLower.includes(queryTokenLower)) {
				tokenScore += 5;
			}
		}

		return tokenScore;
	}

	private matchesAtWordBoundary(title: string, queryLower: string): boolean {
		const parts = title.split(/(?=[A-Z])/);

		for (let i = 0; i < parts.length; i++) {
			const suffix = parts.slice(i).join('').toLowerCase();
			if (suffix.startsWith(queryLower)) {
				return true;
			}
		}

		return false;
	}

	private isValidCacheData(data: unknown): data is SymbolData | FrameworkData {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const object = data as Record<string, unknown>;

		if (!('abstract' in object) || !('metadata' in object)) {
			return false;
		}

		const {metadata} = object;
		if (!metadata || typeof metadata !== 'object') {
			return false;
		}

		return true;
	}

	private tokenize(text: string): string[] {
		if (!text) {
			return [];
		}

		const tokens = new Set<string>();
		const basicTokens = text.split(/[\s/._-]+/).filter(Boolean);

		for (const token of basicTokens) {
			tokens.add(token.toLowerCase());
			tokens.add(token);

			const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
			if (camelParts.length > 1) {
				for (const part of camelParts) {
					tokens.add(part.toLowerCase());
					tokens.add(part);
				}

				tokens.add(camelParts.join('').toLowerCase());
			}
		}

		return [...tokens];
	}

	/**
	 * Generate a unique key for deduplication based on title
	 * This ensures same-named symbols are deduplicated regardless of source
	 */
	private generateSymbolKey(title: string): string {
		return title.toLowerCase();
	}

	/**
	 * Add or update a symbol entry
	 * Priority: 1) entry with path, 2) entry with longer abstract
	 */
	private upsertSymbol(entry: LocalSymbolIndexEntry): void {
		const key = this.generateSymbolKey(entry.title);
		const existing = this.symbols.get(key);

		if (!existing) {
			this.symbols.set(key, entry);
			return;
		}

		// Prefer entry with path over entry without path
		if (!existing.path && entry.path) {
			this.symbols.set(key, entry);
			return;
		}

		// If both have paths, prefer entry with more detailed abstract
		if (existing.path && entry.path && entry.abstract.length > existing.abstract.length) {
			this.symbols.set(key, entry);
		}

		// If existing has path but new doesn't, keep existing (do nothing)
	}

	private processSymbolData(data: SymbolData | FrameworkData, filePath: string): void {
		const title = data.metadata?.title ?? 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) ?? [];

		if (this.technologyIdentifier && path) {
			const technologyPath = this.technologyIdentifier.toLowerCase();
			const symbolPath = path.toLowerCase();
			if (!symbolPath.includes(technologyPath)) {
				return;
			}
		}

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

		this.upsertSymbol(entry);
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

		for (const ref of Object.values(references)) {
			if (ref.kind === 'symbol' && ref.title) {
				const refPath = ref.url ?? '';

				if (this.technologyIdentifier && refPath) {
					const technologyPath = this.technologyIdentifier.toLowerCase();
					if (!refPath.toLowerCase().includes(technologyPath)) {
						continue;
					}
				}

				const refTokens = this.createTokens(
					ref.title,
					this.client.extractText(ref.abstract ?? []),
					refPath,
					ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
				);

				const refEntry: LocalSymbolIndexEntry = {
					id: refPath || ref.title,
					title: ref.title,
					path: refPath,
					kind: ref.kind,
					abstract: this.client.extractText(ref.abstract ?? []),
					platforms: ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
					tokens: refTokens,
					filePath,
				};

				// Use same key generation for deduplication
				this.upsertSymbol(refEntry);
			}
		}
	}
}
