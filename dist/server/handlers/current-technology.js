import { bold, header } from '../markdown.js';
import { buildNoTechnologyMessage } from './no-technology.js';
export const buildCurrentTechnologyHandler = (context) => {
    const noTechnology = buildNoTechnologyMessage(context);
    return async () => {
        const active = context.state.getActiveTechnology();
        if (!active) {
            return noTechnology();
        }
        const lines = [
            header(1, '📘 Current Technology'),
            '',
            bold('Name', active.title),
            bold('Identifier', active.identifier),
            '',
            header(2, 'Next actions'),
            '• `search_symbols { "query": "keyword" }` to find symbols',
            '• `get_documentation { "path": "SymbolName" }` to open docs',
            '• `choose_technology "Another Framework"` to switch',
        ];
        return {
            content: [{ text: lines.join('\n'), type: 'text' }],
        };
    };
};
//# sourceMappingURL=current-technology.js.map