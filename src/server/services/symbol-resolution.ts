import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type {
	AppleDevDocsClient,
	SymbolData,
	Technology,
} from '../../apple-client.js';

const normalizePath = (path: string): string =>
	path.startsWith('/') ? path.slice(1) : path;

export const getFrameworkName = (technology: Technology): string => {
	const frameworkName = technology.identifier.split('/').at(-1);
	if (!frameworkName) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`Invalid technology identifier: ${technology.identifier}`,
		);
	}

	return frameworkName;
};

const buildCandidatePaths = (
	technology: Technology,
	path: string,
): string[] => {
	const normalizedPath = normalizePath(path.trim());
	const frameworkName = getFrameworkName(technology);
	const candidates = new Set<string>();

	if (normalizedPath && !normalizedPath.startsWith('documentation/')) {
		candidates.add(`documentation/${frameworkName}/${normalizedPath}`);
	}

	if (normalizedPath) {
		candidates.add(normalizedPath);
	}

	return [...candidates];
};

export const resolveSymbol = async (
	client: AppleDevDocsClient,
	technology: Technology,
	path: string,
): Promise<{ data: SymbolData; targetPath: string }> => {
	let lastError: unknown;

	for (const candidate of buildCandidatePaths(technology, path)) {
		try {
			const data = await client.getSymbol(candidate);
			return { data, targetPath: candidate };
		} catch (error) {
			lastError = error;
		}
	}

	throw new McpError(
		ErrorCode.InvalidRequest,
		`Failed to load documentation for "${path}": ${lastError instanceof Error ? lastError.message : String(lastError)}`,
	);
};
