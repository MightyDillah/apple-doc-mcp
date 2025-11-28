/**
 * Tokenizes text for search indexing and matching.
 * Handles camelCase/PascalCase splitting and common delimiters.
 */
export const tokenize = (text: string): string[] => {
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
};

/**
 * Creates a comprehensive set of tokens from symbol metadata.
 */
export const createSearchTokens = (
	title: string,
	abstract: string,
	path: string,
	platforms: string[],
): string[] => {
	const tokens = new Set<string>();

	for (const token of tokenize(title)) {
		tokens.add(token);
	}

	for (const token of tokenize(abstract)) {
		tokens.add(token);
	}

	for (const token of tokenize(path)) {
		tokens.add(token);
	}

	for (const platform of platforms) {
		for (const token of tokenize(platform)) {
			tokens.add(token);
		}
	}

	return [...tokens];
};
