/**
 * Extracts the framework name from a technology identifier.
 * @example "doc://com.apple.documentation/documentation/SwiftUI" -> "SwiftUI"
 */
export const extractFrameworkName = (identifier: string): string | undefined => {
	const parts = identifier.split('/');
	return parts.at(-1) ?? undefined;
};

/**
 * Normalizes a symbol path by removing the doc:// prefix and ensuring proper format.
 * @example "doc://com.apple.documentation/documentation/SwiftUI/View" -> "documentation/SwiftUI/View"
 */
export const normalizeSymbolPath = (path: string): string => path
	.replace('doc://com.apple.documentation/', '')
	.replace(/^documentation\//, 'documentation/');

/**
 * Removes leading slash from a path if present.
 */
export const removeLeadingSlash = (path: string): string => (path.startsWith('/') ? path.slice(1) : path);

/**
 * Extracts the technology path from an identifier for filtering purposes.
 * @example "doc://com.apple.documentation/documentation/SwiftUI" -> "documentation/SwiftUI"
 */
export const extractTechnologyPath = (identifier: string): string => identifier
	.replace('doc://com.apple.documentation/', '')
	.replace(/^documentation\//, '');
