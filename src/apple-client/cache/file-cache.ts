import {promises as fs} from 'node:fs';
import {join} from 'node:path';
import process from 'node:process';
import type {FrameworkData, SymbolData, Technology} from '../types/index.js';

export class FileCache {
	private readonly docsDir: string;
	private readonly technologiesCachePath: string;

	constructor(baseDir: string = process.cwd()) {
		this.docsDir = join(baseDir, 'docs');
		this.technologiesCachePath = join(this.docsDir, 'technologies.json');
	}

	async loadFramework(frameworkName: string): Promise<FrameworkData | undefined> {
		await this.ensureDocsDir();
		try {
			const raw = await fs.readFile(this.getDocsPath(frameworkName), 'utf8');
			return JSON.parse(raw) as FrameworkData;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveFramework(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureDocsDir();
		await fs.writeFile(this.getDocsPath(frameworkName), JSON.stringify(data, null, 2));
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
		await this.ensureDocsDir();
		const safePath = path.replaceAll('/', '__');
		await fs.writeFile(join(this.docsDir, `${safePath}.json`), JSON.stringify(data, null, 2));
	}

	async loadTechnologies(): Promise<Record<string, Technology> | undefined> {
		await this.ensureDocsDir();
		try {
			const data = await fs.readFile(this.technologiesCachePath, 'utf8');
			const parsed = JSON.parse(data) as unknown;

			// Handle different possible formats of the cached data
			if (parsed && typeof parsed === 'object' && 'references' in parsed) {
				const wrapper = parsed as {references?: Record<string, Technology>};
				return wrapper.references ?? {};
			}

			return parsed as Record<string, Technology>;
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async saveTechnologies(technologies: Record<string, Technology>): Promise<void> {
		await this.ensureDocsDir();
		await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
	}

	private sanitizeFrameworkName(name: string): string {
		return name.replaceAll(/[^\w-]/gi, '_');
	}

	private async ensureDocsDir(): Promise<void> {
		await fs.mkdir(this.docsDir, {recursive: true});
	}

	private getDocsPath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.docsDir, `${safeName}.json`);
	}
}
