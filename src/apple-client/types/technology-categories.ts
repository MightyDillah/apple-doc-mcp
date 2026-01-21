import type {Technology} from './index.js';

/**
 * Technology filter configuration for supported documentation types
 */
export type TechnologyFilter = {
	kind: string;
	role: string;
	category: 'framework' | 'resources';
};

/**
 * Supported technology filters for the discover and choose handlers
 */
const technologyFilters: TechnologyFilter[] = [
	// Standard frameworks (e.g., SwiftUI, UIKit)
	{kind: 'symbol', role: 'collection', category: 'framework'},
	// Resource collections (e.g., BundleResources for Info.plist keys)
	{kind: 'article', role: 'collection', category: 'resources'},
	// Dictionary symbols (for property list keys)
	{kind: 'dictionarySymbol', role: 'collection', category: 'resources'},
];

/**
 * Check if a technology matches any of the supported filters
 */
export const isSupportedTechnology = (tech: Technology | {kind?: string; role?: string}): boolean =>
	technologyFilters.some(filter => tech.kind === filter.kind && tech.role === filter.role);

/**
 * Get the category of a technology based on its kind and role
 */
export const getTechnologyCategory = (tech: Technology | {kind?: string; role?: string}): 'framework' | 'resources' | 'unknown' => {
	const filter = technologyFilters.find(f => tech.kind === f.kind && tech.role === f.role);
	return filter?.category ?? 'unknown';
};

/**
 * Filter technologies to only include supported types
 */
export const filterSupportedTechnologies = <T extends {kind?: string; role?: string}>(technologies: T[]): T[] =>
	technologies.filter(tech => isSupportedTechnology(tech));
