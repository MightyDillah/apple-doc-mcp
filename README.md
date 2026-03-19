# Apple Doc MCP

A Model Context Protocol (MCP) server that provides seamless access to Apple's Developer Documentation directly within your AI coding assistant.
**Note:** Hey guys, thanks for checking out this MCP! Since I've been working on it on a regular basis, and as such its getting really expensive to build it and improve it to work on different platforms, all while adding new features (tokens aint cheap ya'll).

if you find this MCP helpful, I'd really apperciate it if you clicked on the [❤️ Sponsor](https://github.com/sponsors/MightyDillah) button up there, any contribution is apperciated! thanks.

## 📋 Changelog

Thank you to the Github team for gifting me a year subscription to Copilot Pro+ you guys rock! and thank you @billibala, @theoddbrick, @christopherbattlefrontlegal for sponsoring! you guys are amazing.

- Full release history lives in [CHANGELOG.md](CHANGELOG.md).

- 1.9.6
  - MAJOR FIX: Simplified `search_symbols` to be more predictable for AI agents
  - Added exact symbol resolution inside `search_symbols` for queries like `GridItem`, `View`, and `ButtonStyle`
  - Changed `search_symbols` to return symbol-first results with articles and guides separated into their own section
  - Fixed wildcard behavior so fallback search respects `*` and `?` patterns instead of degrading to plain substring matches
  - Removed misleading search messaging about background downloads and "comprehensive" indexing
  - Removed dead or unused search code paths that were adding confusion without improving results
  - Fixed first-search index initialization so cache-backed symbol search finishes building before results are used
- 1.9.1
  - Moved cached docs into `.cache/` to keep the repo clean
  - Routed MCP logging to stderr so protocol stdout stays clean (this was breaking codex symbol search)

## Installation

## VS Code

1. Open Command Palette (`Shift+Cmd+P`).
2. Run `MCP: Add Server`.
3. When prompted for server type, choose `npm`.
4. Enter this package:

```text
apple-doc-mcp-server
```

## Claude Code:

```bash
claude mcp add apple-docs -- npx apple-doc-mcp-server@latest
```

## OpenAI Codex:

```bash
codex mcp add apple-doc-mcp -- npx apple-doc-mcp-server@latest
```
## Manual:

```json
{
	"mcpServers": {
		"apple-docs": {
			"command": "npx",
			"args": ["apple-doc-mcp-server@latest"]
		}
	}
}
```

## Local:

```bash
yarn install
yarn build
```

```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "node",
      "args": ["/absolute/path/to/apple-doc-mcp/dist/index.js"]
    }
  }
}
```

### Search Tips

- Use exact API names when you know them (`"GridItem"`, `"ButtonStyle"`, `"View"`).
- Start broad (e.g. `"tab"`, `"animation"`, `"gesture"`).
- Try synonyms (`"sheet"` vs `"modal"`, `"toolbar"` vs `"tabbar"`).
- Use wildcards (`"Grid*"`, `"*Item"`, `"Lazy*"`) for flexible matching.
- Use multiple keywords (`"tab view layout"`) to narrow results.
- If nothing turns up, re-run `discover_technologies` with a different keyword or pick another framework.
- `search_symbols` returns symbols first and lists matching articles separately.

## Available Tools

- `discover_technologies` – browse/filter frameworks before selecting one.
- `choose_technology` – set the active framework; required before searching docs.
- `current_technology` – show the current selection and quick next steps.
- `search_symbols` – symbol-first search with exact-name resolution, wildcard support, and separate article results.
- `get_documentation` – open detailed docs for a known symbol or documentation path.
- `get_version` – get current MCP server version information.