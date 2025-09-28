import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';

const baseUrl = 'https://developer.apple.com/tutorials/data';

const headers = {
	dnt: '1',
	referer: 'https://developer.apple.com/documentation',
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

export type PlatformInfo = {
	name: string;
	introducedAt: string;
	beta?: boolean;
};

export type FrameworkData = {
	abstract: Array<{text: string; type: string}>;
	metadata: {
		platforms: PlatformInfo[];
		role: string;
		title: string;
	};
	references: Record<string, ReferenceData>;
	topicSections: TopicSection[];
};

export type SearchResult = {
	description: string;
	framework: string;
	path: string;
	platforms?: string;
	symbolKind?: string;
	title: string;
};

export type SymbolData = {
	abstract: Array<{text: string; type: string}>;
	metadata: {
		platforms: PlatformInfo[];
		symbolKind: string;
		title: string;
	};
	primaryContentSections: any[];
	references: Record<string, ReferenceData>;
	topicSections: TopicSection[];
};

export type Technology = {
	abstract: Array<{text: string; type: string}>;
	identifier: string;
	kind: string;
	role: string;
	title: string;
	url: string;
};

export type TopicSection = {
	anchor?: string;
	identifiers: string[];
	title: string;
};

export type ReferenceData = {
	title: string;
	kind?: string;
	abstract?: Array<{text: string; type: string}>;
	platforms?: PlatformInfo[];
	url: string;
};

type CacheEntry<T> = {
	data: T;
	timestamp: number;
};

export class AppleDevDocsClient {
	private readonly cache = new Map<string, CacheEntry<any>>();
	private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes
	private readonly technologiesCachePath = join(process.cwd(), 'technologies.json');
	private readonly frameworkCacheDir = join(process.cwd(), 'dist', 'tech');

	private sanitizeFrameworkName(name: string): string {
		return name.replace(/[^a-z0-9-_]/gi, '_');
	}

	private getFrameworkCachePath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.frameworkCacheDir, `${safeName}.json`);
	}

	private async ensureFrameworkCacheDir(): Promise<void> {
		await fs.mkdir(this.frameworkCacheDir, {recursive: true});
	}

	private async loadCachedFramework(frameworkName: string): Promise<FrameworkData | null> {
		try {
			const raw = await fs.readFile(this.getFrameworkCachePath(frameworkName), 'utf-8');
			return JSON.parse(raw) as FrameworkData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return null;
			}

			throw error;
		}
	}

	private async saveFrameworkCache(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureFrameworkCacheDir();
		await fs.writeFile(this.getFrameworkCachePath(frameworkName), JSON.stringify(data, null, 2));
	}

	// Helper to extract text from abstract array
	extractText(abstract: Array<{text: string; type: string}>): string {
		return abstract?.map(item => item.text).join('') || '';
	}

	// Load technologies from persistent cache
	private async loadCachedTechnologies(): Promise<Record<string, Technology> | null> {
		try {
			const data = await fs.readFile(this.technologiesCachePath, 'utf-8');
			const parsed = JSON.parse(data);

			// The cached file contains the full API response, but we need to extract the technologies
			// The technologies are in the references object
			return parsed.references || parsed;
		} catch {
			return null;
		}
	}

	// Save technologies to persistent cache
	private async saveCachedTechnologies(technologies: Record<string, Technology>): Promise<void> {
		try {
			await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
		} catch (error) {
			console.warn('Failed to save technologies cache:', error instanceof Error ? error.message : String(error));
		}
	}

	// Helper to format platform availability
	formatPlatforms(platforms: PlatformInfo[]): string {
		if (!platforms || platforms.length === 0) {
			return 'All platforms';
		}

		return platforms
			.map(p => `${p.name} ${p.introducedAt}+${p.beta ? ' (Beta)' : ''}`)
			.join(', ');
	}

	async getFramework(frameworkName: string): Promise<FrameworkData> {
		const cached = await this.loadCachedFramework(frameworkName);
		if (cached) {
			return cached;
		}

		const url = `${baseUrl}/documentation/${frameworkName}.json`;
		const data = await this.makeRequest<FrameworkData>(url);
		await this.saveFrameworkCache(frameworkName, data);
		return data;
	}

	async refreshFramework(frameworkName: string): Promise<FrameworkData> {
		const url = `${baseUrl}/documentation/${frameworkName}.json`;
		const data = await this.makeRequest<FrameworkData>(url);
		await this.saveFrameworkCache(frameworkName, data);
		return data;
	}

	async getSymbol(path: string): Promise<SymbolData> {
		// Remove leading slash if present
		const cleanPath = path.startsWith('/') ? path.slice(1) : path;
		const url = `${baseUrl}/${cleanPath}.json`;
		return this.makeRequest<SymbolData>(url);
	}

	async getTechnologies(): Promise<Record<string, Technology>> {
		// Try to load from persistent cache first
		const cached = await this.loadCachedTechnologies();
		if (cached) {
			return cached;
		}

		// If no cache, download from API and save
		const url = `${baseUrl}/documentation/technologies.json`;
		const data = await this.makeRequest<Record<string, Technology>>(url);

		if (data) {
			await this.saveCachedTechnologies(data);
		}

		return data || {};
	}

	// Force refresh technologies cache (user-invoked)
	async refreshTechnologies(): Promise<Record<string, Technology>> {
		const url = `${baseUrl}/documentation/technologies.json`;
		const data = await this.makeRequest<Record<string, Technology>>(url);

		if (data) {
			await this.saveCachedTechnologies(data);
		}

		return data || {};
	}

	// NEW: Search within a specific framework
	async searchFramework(frameworkName: string, query: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	} = {}): Promise<SearchResult[]> {
		const {maxResults = 20} = options;
		const results: SearchResult[] = [];

		try {
			const framework = await this.getFramework(frameworkName);
			const searchPatterns = this.createSearchPatterns(query);

			for (const [id, ref] of Object.entries(framework.references)) {
				if (results.length >= maxResults) {
					continue;
				}

				const description = this.extractText(ref.abstract ?? []);
				if (this.matchesSearch(ref, searchPatterns, description, options)) {
					results.push({
						description,
						framework: frameworkName,
						path: ref.url,
						platforms: this.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
						symbolKind: ref.kind,
						title: ref.title,
					});
				}
			}

			return results.sort((a, b) => this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query));
		} catch (error) {
			throw new Error(`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// NEW: Search across all frameworks
	async searchGlobal(query: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	} = {}): Promise<SearchResult[]> {
		const {maxResults = 50} = options;
		const results: SearchResult[] = [];

		try {
			const technologies = await this.getTechnologies();
			const frameworks = Object.values(technologies).filter(tech => tech.kind === 'symbol' && tech.role === 'collection');

			// Use all available frameworks (now cached locally, no API abuse)
			const searchFrameworks = frameworks;

			for (const framework of searchFrameworks) {
				if (results.length >= maxResults) {
					break;
				}

				try {
					// eslint-disable-next-line no-await-in-loop
					const frameworkResults = await this.searchFramework(framework.title, query, {
						maxResults: Math.ceil(maxResults / 4), // Distribute across frameworks
						platform: options.platform,
						symbolType: options.symbolType,
					});
					results.push(...frameworkResults);
				} catch (error) {
					// Continue on individual framework errors
					console.warn(`Failed to search ${framework.title}:`, error instanceof Error ? error.message : String(error));
				}
			}

			return results.slice(0, maxResults);
		} catch (error) {
			throw new Error(`Global search failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Helper: Create search patterns (supports wildcards)
	private createSearchPatterns(query: string): RegExp[] {
		// Split query into individual terms (respecting quoted phrases)
		const terms = this.parseSearchQuery(query);
		return terms.map(term => {
			// Convert wildcard pattern to regex
			const escaped = term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
			const pattern = escaped.replaceAll(String.raw`\*`, '.*').replaceAll(String.raw`\?`, '.');
			return new RegExp(pattern, 'i');
		});
	}

	// Helper: Parse search query into terms (handles quoted phrases)
	private parseSearchQuery(query: string): string[] {
		const terms: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < query.length; i++) {
			const char = query[i];
			if (char === '"') {
				inQuotes = !inQuotes;
				if (!inQuotes && current.trim()) {
					terms.push(current.trim());
					current = '';
				}
			} else if (char === ' ' && !inQuotes) {
				if (current.trim()) {
					terms.push(current.trim());
					current = '';
				}
			} else {
				current += char;
			}
		}

		if (current.trim()) {
			terms.push(current.trim());
		}

		return terms;
	}

	private async makeRequest<T>(url: string): Promise<T> {
		// Simple cache check
		const cached = this.cache.get(url);
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			return cached.data as T;
		}

		try {
			const response = await axios.get<T>(url, {
				headers,
				timeout: 15_000, // 15 second timeout
			});

			// Cache the result
			this.cache.set(url, {
				data: response.data,
				timestamp: Date.now(),
			});

			return response.data;
		} catch (error) {
			console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : String(error));
			throw new Error(`Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Helper: Check if reference matches search criteria
	private matchesSearch(ref: ReferenceData, patterns: RegExp[], description: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	}): boolean {
		if (!ref.title) {
			return false;
		}

		// Check if any pattern matches in title or description
		const titleMatch = patterns.some(pattern => pattern.test(ref.title));
		const descMatch = description && patterns.some(pattern => pattern.test(description));

		if (!titleMatch && !descMatch) {
			return false;
		}

		// Symbol type filter
		if (options.symbolType && ref.kind !== options.symbolType) {
			return false;
		}

		// Platform filter (simplified)
		if (options.platform && ref.platforms) {
			const hasPlat = ref.platforms.some((p: PlatformInfo) =>
				p.name?.toLowerCase().includes(options.platform!.toLowerCase()));
			if (!hasPlat) {
				return false;
			}
		}

		return true;
	}

	// Helper: Score match quality (lower = better)
	private scoreMatch(title: string, query: string): number {
		const lowerTitle = title.toLowerCase();
		const lowerQuery = query.replaceAll('*', '').toLowerCase();

		if (lowerTitle === lowerQuery) {
			return 0;
		} // Exact match

		if (lowerTitle.startsWith(lowerQuery)) {
			return 1;
		} // Prefix match

		if (lowerTitle.includes(lowerQuery)) {
			return 2;
		} // Contains match

		return 3; // Pattern match
	}
}
