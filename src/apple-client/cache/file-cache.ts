import {promises as fs} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {FrameworkData, SymbolData, Technology} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class FileCache {
	private readonly docsDir: string;
	private readonly technologiesCachePath: string;

	constructor(baseDir?: string) {
		// Use MCP's own directory structure instead of process.cwd()
		const mcpRoot = join(__dirname, '../../..');
		this.docsDir = join(baseDir ?? mcpRoot, 'cache');
		this.technologiesCachePath = join(this.docsDir, 'technologies.json');
	}

	async loadFramework(frameworkName: string): Promise<FrameworkData | undefined> {
		await this.ensureCacheDir();
		try {
			const raw = await fs.readFile(this.getCachePath(frameworkName), 'utf8');
			return JSON.parse(raw) as FrameworkData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveFramework(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureCacheDir();
		await fs.writeFile(this.getCachePath(frameworkName), JSON.stringify(data, null, 2));
	}

	async loadSymbol(path: string): Promise<SymbolData | undefined> {
		try {
			const safePath = path.replaceAll('/', '__');
			const raw = await fs.readFile(join(this.docsDir, `${safePath}.json`), 'utf8');
			return JSON.parse(raw) as SymbolData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveSymbol(path: string, data: SymbolData): Promise<void> {
		await this.ensureCacheDir();
		const safePath = path.replaceAll('/', '__');
		await fs.writeFile(join(this.docsDir, `${safePath}.json`), JSON.stringify(data, null, 2));
	}

	async loadTechnologies(): Promise<Record<string, Technology> | undefined> {
		await this.ensureCacheDir();
		try {
			const data = await fs.readFile(this.technologiesCachePath, 'utf8');
			const parsed = JSON.parse(data) as unknown;

			// Handle different possible formats of the cached data
			if (parsed && typeof parsed === 'object') {
				// First try: data has a 'references' property (new format from API)
				if ('references' in parsed) {
					const wrapper = parsed as {references?: Record<string, Technology>};
					const refs = wrapper.references ?? {};
					// Validate that we got actual technology data
					if (Object.keys(refs).length > 0) {
						return refs;
					}
				}

				// Second try: data is already the references object (legacy format)
				const direct = parsed as Record<string, Technology>;
				if (Object.keys(direct).length > 0) {
					// Check if it looks like technology data (has identifier/title fields)
					const firstValue = Object.values(direct)[0];
					if (firstValue && typeof firstValue === 'object' && ('identifier' in firstValue || 'title' in firstValue)) {
						return direct;
					}
				}
			}

			// If we got here, the cache might be corrupted or empty
			console.warn('Technologies cache exists but appears invalid, will refetch');
			return undefined;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			console.error('Error loading technologies cache:', error);
			throw error;
		}
	}

	async saveTechnologies(technologies: Record<string, Technology>): Promise<void> {
		await this.ensureCacheDir();
		await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
	}

	private sanitizeFrameworkName(name: string): string {
		return name.replaceAll(/[^\w-]/gi, '_');
	}

	private async ensureCacheDir(): Promise<void> {
		await fs.mkdir(this.docsDir, {recursive: true});
	}

	private getCachePath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.docsDir, `${safeName}.json`);
	}
}
