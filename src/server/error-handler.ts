import {McpError} from '@modelcontextprotocol/sdk/types.js';
import {isAppleDocError} from '../errors.js';
import type {ToolResponse} from './context.js';

type ToolHandler<T> = (args: T) => Promise<ToolResponse>;

/**
 * Formats an error into a user-friendly response
 */
const formatErrorResponse = (error: unknown): ToolResponse => {
	// Handle AppleDocError with structured message
	if (isAppleDocError(error)) {
		return {
			content: [{
				text: `❌ **Error:** ${error.message}${error.suggestion ? `\n\n💡 **Suggestion:** ${error.suggestion}` : ''}`,
				type: 'text',
			}],
			isError: true,
		};
	}

	// Handle McpError
	if (error instanceof McpError) {
		return {
			content: [{
				text: `❌ **Error:** ${error.message}`,
				type: 'text',
			}],
			isError: true,
		};
	}

	// Handle standard errors
	if (error instanceof Error) {
		return {
			content: [{
				text: `❌ **Error:** ${error.message}\n\n💡 **Suggestion:** If this persists, try a different search query or check the symbol path.`,
				type: 'text',
			}],
			isError: true,
		};
	}

	// Handle unknown errors
	return {
		content: [{
			text: `❌ **Error:** An unexpected error occurred: ${String(error)}\n\n💡 **Suggestion:** Please try again or use a different approach.`,
			type: 'text',
		}],
		isError: true,
	};
};

/**
 * Wraps a tool handler with error handling that formats errors nicely
 */
export const withErrorHandling = <T>(handler: ToolHandler<T>): ToolHandler<T> =>
	async (args: T): Promise<ToolResponse> => {
		try {
			return await handler(args);
		} catch (error) {
			// Log the error for debugging
			console.error('Tool handler error:', error instanceof Error ? error.message : String(error));

			// Return formatted error response
			return formatErrorResponse(error);
		}
	};

/**
 * Re-throws McpError unchanged, converts other errors to formatted responses
 * Use this when you want McpError to propagate but catch other errors
 */
export const withMcpErrorPassthrough = <T>(handler: ToolHandler<T>): ToolHandler<T> =>
	async (args: T): Promise<ToolResponse> => {
		try {
			return await handler(args);
		} catch (error) {
			// Let McpError propagate unchanged
			if (error instanceof McpError) {
				throw error;
			}

			// Log the error for debugging
			console.error('Tool handler error:', error instanceof Error ? error.message : String(error));

			// Return formatted error response for other errors
			return formatErrorResponse(error);
		}
	};
