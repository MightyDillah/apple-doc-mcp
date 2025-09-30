# Apple Doc MCP

A Model Context Protocol (MCP) server that provides seamless access to Apple's Developer Documentation directly within your AI coding assistant.

**Note:** Hey guys, thanks for checking out this MCP! Since I've been working on it on a regular basis, and as such its getting really expensive to build it and improve it to work on different platforms, all while adding new features (tokens aint cheap ya'll). 

if you find this MCP helpful, I'd really apperciate it if you clicked on the [❤️ Sponsor](https://github.com/sponsors/MightyDillah) button up there, any contribution is apperciated! thanks.

## 📋 Changelog
- 1.5.1 (Major update!)
  - Now on npm! someone annoying already uploaded it under apple-doc-mcp and theres no way to reach them so I had to rename it to apple-doc-mcp-server thanks random guy!
  - Introduced per-technology caching, mandatory framework selection, and the guided discovery/search flow.
  - Now it doesnt spam the doc server, all tech is cached after first call making every search super efficient!
  - Uses several search fallbacks to make sure it finds what youre looking for, and if it fails it'll do a regex to the entire technology and still give you suggestions!
  - It now asks you which doc is more relevant! and has very rudemntary fuzzy search but it works really well!
  - Simplified MCP in so many ways that I am just kicking myself!
  - Handlers now live in 'src/server/handlers/', so each tool is easy to read and evolve without touching the entrypoint.
  - This should have been version 1.0.0, there are still some kinks so please report them.

- 1.0.2 - Completely removed due to AI slop, sorry I merged without thoroughly going through this.
- 1.0.1 – Initial release.

## Quick Start

```"Use apple mcp select swiftui search tabbar"```

Configure your MCP client (example):

Using npx (recommended):
```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": [
        "apple-doc-mcp-server@latest"
      ]
    }
  }
}
```

Claude Code:
```bash
claude mcp add apple-docs -- npx apple-doc-mcp-server@latest
```

Or using node with the built file:
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

For local development:
```bash
npm install
npm build
```

## 🔄 Typical Workflow

1. Explore the catalogue:
   - `discover_technologies { "query": "swift" }`
   - `discover_technologies { "page": 2, "pageSize": 10 }`
2. Lock in a framework:
   - `choose_technology "SwiftUI"`
   - `current_technology`
3. Search within the active framework:
   - `search_symbols { "query": "tab view layout" }`
   - `search_symbols { "query": "toolbar", "maxResults": 5 }`
4. Open documentation:
   - `get_documentation { "path": "TabView" }`
   - `get_documentation { "path": "documentation/SwiftUI/TabViewStyle" }`

### Search Tips
- Start broad (e.g. `"tab"`, `"animation"`, `"gesture"`).
- Try synonyms (`"sheet"` vs `"modal"`, `"toolbar"` vs `"tabbar"`).
- Use multiple keywords (`"tab view layout"`) to narrow results.
- If nothing turns up, re-run `discover_technologies` with a different keyword or pick another framework.

## 🧰 Available Tools
- `discover_technologies` – browse/filter frameworks before selecting one.
- `choose_technology` – set the active framework; required before searching docs.
- `current_technology` – show the current selection and quick next steps.
- `search_symbols` – fuzzy keyword search within the active framework.
- `get_documentation` – view symbol docs (relative names allowed).
