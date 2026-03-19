import type { ServerContext, ToolResponse } from '../context.js';
import { header, bold } from '../markdown.js';

export const buildNoTechnologyMessage =
	({ client, state }: ServerContext) =>
	async (): Promise<ToolResponse> => {
		const lastDiscovery = state.getLastDiscovery();

		// Get available technologies for better guidance
		let availableTechnologies: string[] = [];
		try {
			const technologies = await client.getTechnologies();
			// Filter out invalid entries and get only proper technologies
			availableTechnologies = Object.values(technologies)
				.filter(
					(tech) =>
						tech.title && tech.kind === 'symbol' && tech.role === 'collection',
				)
				.slice(0, 8)
				.map((t) => t.title);
		} catch (error) {
			console.warn('Failed to get technologies for error message:', error);
		}

		const lines = [
			header(1, '🚫 Search Cannot Proceed - No Technology Selected'),
			'',
			bold(
				'❌ IMPORTANT:',
				'Symbol searches and documentation lookups CANNOT work without first selecting a technology.',
			),
			'',
			'This is a required step because Apple documentation is organized by technology/framework.',
			'',
			header(2, '🔧 Required Steps'),
			'',
			bold('Step 1:', 'Discover available technologies'),
			'• `discover_technologies` — see all available Apple technologies',
			'• `discover_technologies { "query": "swift" }` — filter by keyword',
			'• `discover_technologies { "query": "ui" }` — find UI frameworks',
			'',
			bold('Step 2:', 'Choose a technology'),
			'• `choose_technology { "name": "SwiftUI" }` — select SwiftUI',
			'• `choose_technology { "name": "UIKit" }` — select UIKit',
			'• `choose_technology { "name": "AppKit" }` — select AppKit',
			'',
			bold('Step 3:', 'Now you can search'),
			'• `search_symbols { "query": "Button" }` — exact symbols resolve directly',
			'• `search_symbols { "query": "Grid*" }` — search symbols with wildcards',
			'• `get_documentation { "path": "View" }` — get detailed docs',
			'',
			header(2, '📚 Available Technologies'),
		];

		if (availableTechnologies.length > 0) {
			lines.push('', 'Popular technologies you can choose from:');
			for (const tech of availableTechnologies) {
				lines.push(
					`• **${tech}** — \`choose_technology { "name": "${tech}" }\``,
				);
			}

			if (availableTechnologies.length === 8) {
				lines.push(
					'• **...and many more** — use `discover_technologies` to see all options',
				);
			}
		} else {
			lines.push(
				'',
				'Use `discover_technologies` to see all available Apple technologies.',
			);
		}

		lines.push(
			'',
			header(2, '💡 Quick Start Examples'),
			'',
			'**For SwiftUI development:**',
			'1. `discover_technologies { "query": "swiftui" }`',
			'2. `choose_technology { "name": "SwiftUI" }`',
			'3. `search_symbols { "query": "Button" }`',
			'',
			'**For UIKit development:**',
			'1. `discover_technologies { "query": "uikit" }`',
			'2. `choose_technology { "name": "UIKit" }`',
			'3. `search_symbols { "query": "UIButton" }`',
		);

		if (lastDiscovery?.results?.length) {
			lines.push('', header(2, '🔄 Recently Discovered'));
			for (const result of lastDiscovery.results.slice(0, 3)) {
				lines.push(
					`• **${result.title}** — \`choose_technology { "name": "${result.title}" }\``,
				);
			}
		}

		return {
			content: [{ text: lines.join('\n'), type: 'text' }],
		};
	};
