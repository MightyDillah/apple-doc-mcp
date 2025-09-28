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
	private readonly docsDir = join(process.cwd(), 'docs');
	private readonly technologiesCachePath = join(this.docsDir, 'technologies.json');

	private sanitizeFrameworkName(name: string): string {
		return name.replace(/[^a-z0-9-_]/gi, '_');
	}

	private async ensureDocsDir(): Promise<void> {
		await fs.mkdir(this.docsDir, {recursive: true});
	}

	private getDocsPath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.docsDir, `${safeName}.json`);
	}

	private async loadDocsFramework(frameworkName: string): Promise<FrameworkData | null> {
		await this.ensureDocsDir();
		try {
			const raw = await fs.readFile(this.getDocsPath(frameworkName), 'utf-8');
			return JSON.parse(raw) as FrameworkData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return null;
			}

			throw error;
		}
	}

	private async saveDocsFramework(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureDocsDir();
		await fs.writeFile(this.getDocsPath(frameworkName), JSON.stringify(data, null, 2));
	}

	private async saveSymbolCache(path: string, data: SymbolData): Promise<void> {
		await this.ensureDocsDir();
		const safePath = path.replace(/[\/]/g, '__');
		await fs.writeFile(join(this.docsDir, `${safePath}.json`), JSON.stringify(data, null, 2));
	}

	private async loadSymbolCache(path: string): Promise<SymbolData | null> {
		try {
			const safePath = path.replace(/[\/]/g, '__');
			const raw = await fs.readFile(join(this.docsDir, `${safePath}.json`), 'utf-8');
			return JSON.parse(raw) as SymbolData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return null;
			}

			throw error;
		}
	}

	private async loadCachedTechnologies(): Promise<Record<string, Technology> | null> {
		await this.ensureDocsDir();
		try {
			const data = await fs.readFile(this.technologiesCachePath, 'utf-8');
			const parsed = JSON.parse(data);
			return parsed.references || parsed;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return null;
			}

			throw error;
		}
	}

	private async saveCachedTechnologies(technologies: Record<string, Technology>): Promise<void> {
		await this.ensureDocsDir();
		await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
	}

	// Helper to extract text from abstract array
	extractText(abstract: Array<{text: string; type: string}> = []): string {
		return abstract?.map(item => item.text).join('') || '';
	}

	// Helper to format platform availability
	formatPlatforms(platforms: PlatformInfo[]): string {
		if (!platforms || platforms.length === 0) {
			return 'All platforms';
		}

		return platforms
			.map(p => `${p.name} ${p.introducedAt}${p.beta ? ' (Beta)' : ''}`)
			.join(', ');
	}

	async getFramework(frameworkName: string): Promise<FrameworkData> {
		const docsCached = await this.loadDocsFramework(frameworkName);
		if (docsCached) {
			return docsCached;
		}

		const url = `${baseUrl}/documentation/${frameworkName}.json`;
		const data = await this.makeRequest<FrameworkData>(url);
		await this.saveDocsFramework(frameworkName, data);
		return data;
	}

	async refreshFramework(frameworkName: string): Promise<FrameworkData> {
		const url = `${baseUrl}/documentation/${frameworkName}.json`;
		const data = await this.makeRequest<FrameworkData>(url);
		await this.saveDocsFramework(frameworkName, data);
		return data;
	}

	async getSymbol(path: string): Promise<SymbolData> {
		// Remove leading slash if present
		const cleanPath = path.startsWith('/') ? path.slice(1) : path;
		const url = `${baseUrl}/${cleanPath}.json`;

		const cached = await this.loadSymbolCache(cleanPath);
		if (cached) {
			return cached;
		}

		const data = await this.makeRequest<SymbolData>(url);
		await this.saveSymbolCache(cleanPath, data);
		return data;
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

	async searchFramework(frameworkName: string, query: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	} = {}): Promise<SearchResult[]> {
		const {maxResults = 20} = options;
		const results: SearchResult[] = [];

		try {
			const framework = await this.getFramework(frameworkName);
			const lowerQuery = query.toLowerCase();

			for (const ref of Object.values(framework.references)) {
				if (results.length >= maxResults) {
					break;
				}

				const title = ref.title ?? '';
				const abstractText = this.extractText(ref.abstract ?? []);
				if (!title.toLowerCase().includes(lowerQuery) && !abstractText.toLowerCase().includes(lowerQuery)) {
					continue;
				}

				if (options.symbolType && ref.kind?.toLowerCase() !== options.symbolType.toLowerCase()) {
					continue;
				}

				if (options.platform) {
					const platformLower = options.platform.toLowerCase();
					if (!ref.platforms?.some(p => p.name?.toLowerCase().includes(platformLower))) {
						continue;
					}
				}

				results.push({
					title: ref.title ?? 'Symbol',
					framework: frameworkName,
					path: ref.url,
					description: abstractText,
					symbolKind: ref.kind,
					platforms: this.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
				});
			}

			return results;
		} catch (error) {
			throw new Error(`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`);
		}
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
}
