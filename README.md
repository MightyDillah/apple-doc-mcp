# Apple Doc MCP

A Model Context Protocol (MCP) server that provides seamless access to Apple's Developer Documentation directly within your AI coding assistant.

## 📋 Changelog

### 1.0.2 Update (Container & Containerization Support)
- **📦 Apple Container Documentation**: Added full support for Apple Container documentation with 3 new tools:
  - `list_container_technologies` - Browse all Apple Container frameworks
  - `get_container_documentation` - Get Container symbol or framework docs
  - `search_container_symbols` - Search Container frameworks with wildcards
- **🔄 Apple Containerization Documentation**: Added full support for Apple Containerization documentation with 3 new tools:
  - `list_containerization_technologies` - Browse all Apple Containerization frameworks  
  - `get_containerization_documentation` - Get Containerization symbol or framework docs
  - `search_containerization_symbols` - Search Containerization frameworks with wildcards
- **🛡️ Enhanced Error Handling**: Graceful fallbacks when Container/Containerization documentation sources are unavailable
- **📈 Tool Expansion**: Expanded from 4 tools to 10 total tools for comprehensive Apple documentation coverage

### 1.0.1 Update
- **🎯 Intelligent Fallback System**: When searching for frameworks instead of symbols (e.g., "SwiftUI"), the server now provides helpful framework information and guidance on correct usage
- **🔧 Tool Consolidation**: Streamlined from 4 tools to 4 focused tools:
  - `list_technologies` - Browse all Apple frameworks
  - `get_documentation` - Get symbol or framework docs (handles both automatically)
  - `search_symbols` - Search with wildcards and filters 
  - `check_updates` - Check for repository updates via git
- **🚀 Pre-built Distribution**: No more manual building required - clone and use immediately
- **🧹 Dynamic Framework Discovery**: Removed all hard-coded framework lists for fully dynamic operation
- **⚡ Automatic Update Notifications**: Server automatically checks for updates on startup and notifies users when new versions are available
- **🛡️ Enhanced Error Handling**: Better null safety and professional error messages

## 🚀 Features

- **🔍 Smart Search**: Find symbols across all Apple frameworks with wildcard support (`*`, `?`)
- **📚 Framework Browsing**: Explore any Apple framework structure (SwiftUI, UIKit, Foundation, etc.)
- **📖 Detailed Documentation**: Get comprehensive symbol documentation with examples
- **🎯 Advanced Filtering**: Filter by platform (iOS, macOS, etc.), symbol type, or framework
- **⚡ Real-time Data**: Always up-to-date with Apple's latest documentation
- **🔄 Auto-Update Alerts**: Automatic notifications when repository updates are available
- **🧠 AI-Optimized**: Clean markdown output perfect for AI assistants
- **📦 Container Support**: Full access to Apple Container documentation and frameworks
- **🔄 Containerization Support**: Complete Apple Containerization documentation integration

## 📦 Installation

### Prerequisites
- **Node.js 18+** installed on your system
- **npm** (comes with Node.js)

### Step 1: Clone and Build

1. **Clone this repository:**
   ```bash
   git clone https://github.com/MightyDillah/apple-doc-mcp.git
   cd apple-doc-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
3. **Build the server:**
   ```bash
   npm run build
   ```
   This compiles the TypeScript code and creates the `dist/` folder with the executable server.


### Step 2: Configure Your AI Assistant
  - **Claude Desktop**: Edit `~/.config/claude/claude_desktop_config.json`
  - **Cursor**: Settings (`Cmd/Ctrl + ,`) → Extensions → MCP
  - **Continue.dev**: Edit `~/.continue/config.json`
  - **VS Code (Claude)**: Settings → MCP Servers

```json
{
  "mcpServers": {
    "apple-doc-mcp": {
      "command": "node",
      "args": ["/path/to/apple-doc-mcp/dist/index.js"]
    }
  }
}
```
**⚠️ Important:**: *Replace `/path/to/apple-doc-mcp` with the actual path to your cloned repository.*

**💡 Tip:** To get the absolute path on macOS/Linux, run `pwd` inside the `apple-doc-mcp` folder.

### Step 3: Restart & Test
1. Restart your AI assistant
2. Try: "List available Apple technologies"
3. You should see 4 new tools available
4. The server will automatically notify you if updates are available on startup

## 🔧 Troubleshooting

### "0 tools" or Server Won't Start

- **Check Node.js version:** Ensure you have Node.js 18+ installed (`node --version`)
- **Verify build completed:** Make sure `dist/index.js` exists after running `npm run build`
- **Use absolute paths:** Relative paths in MCP config often fail
- **Check config syntax:** Ensure your JSON configuration is valid
- **Restart completely:** Close and reopen your AI assistant after config changes

### Test the Server Directly

```bash
# Navigate to your project folder
cd /path/to/apple-doc-mcp

# Test the server starts without errors
node dist/index.js
```
You should see: `Apple Developer Documentation MCP server running on stdio`

### Common Path Issues

```bash
# macOS/Linux - Get absolute path
pwd
# Example output: /Users/yourname/projects/apple-doc-mcp

# Windows
echo %cd%
# Example output: C:\Users\yourname\projects\apple-doc-mcp
```

## 🎯 How to Use

Once configured, just talk naturally to your AI assistant. Here are examples:

### Browse Available Technologies
```
"Use apple-doc-mcp to list all current Apple frameworks"
"Get the latest available Apple technologies from Apple's docs"
"Search Apple documentation for all available frameworks"
"List Apple Container technologies and frameworks"
"Browse Apple Containerization documentation frameworks"
```

### Explore a Framework
```
"Use apple-doc-mcp to browse SwiftUI framework structure"
"Get current UIKit topics from Apple documentation"
"Search Apple docs for Foundation framework details"
"Explore Apple Container framework details"
"Get Apple Containerization framework structure"
```

### Search for Specific APIs
```
"Search Apple's SwiftUI docs for drag and drop APIs"
"Use apple-doc-mcp to find RPBroadcast* classes in ReplayKit"
"Look up current *View* symbols across Apple frameworks"
"Find all *Controller classes in UIKit using Apple docs"
"Search Apple Container docs for Image* APIs"
"Find Archive* symbols in Apple Containerization docs"
```

### Get Detailed Documentation
```
"Get the latest SwiftUI View protocol docs from Apple"
"Use apple-doc-mcp to look up UIViewController documentation"
"Search Apple's current docs for NSURLSession details"
"Get Apple Container documentation for ContainerImagesService"
"Look up ContainerizationArchive docs from Apple"
```

The AI will automatically use the MCP tools to fetch current Apple documentation and provide comprehensive answers.

## 🛠️ Available Tools

### Core Apple Developer Documentation

#### `list_technologies`
Browse all available Apple frameworks and technologies.

#### `get_documentation`
Get detailed documentation for symbols or frameworks (automatically detects type).
- `path` (required): Documentation path (e.g., "documentation/SwiftUI/View") or framework name (e.g., "SwiftUI")

**Examples**:
```json
{"path": "SwiftUI"}
{"path": "documentation/SwiftUI/View"}
{"path": "Foundation"}
```

#### `search_symbols`
Search for symbols across Apple frameworks with advanced filtering.
- `query` (required): Search query with wildcard support
- `framework` (optional): Search within specific framework
- `symbolType` (optional): Filter by symbol type (class, protocol, struct, etc.)
- `platform` (optional): Filter by platform (iOS, macOS, etc.)
- `maxResults` (optional): Maximum results (default: 20)

**Examples**:
```json
{"query": "RPBroadcast*"}
{"query": "*Controller", "framework": "UIKit"}
{"query": "*View*", "platform": "iOS", "maxResults": 5}
```

### Apple Container Documentation

#### `list_container_technologies`
Browse all available Apple Container frameworks and technologies.

#### `get_container_documentation`
Get detailed documentation for Apple Container symbols or frameworks.
- `path` (required): Container documentation path (e.g., "documentation/ContainerImagesService") or framework name

**Examples**:
```json
{"path": "ContainerImagesService"}
{"path": "documentation/ContainerImagesService/ImageAPI"}
```

#### `search_container_symbols`
Search for symbols across Apple Container frameworks with advanced filtering.
- `query` (required): Search query with wildcard support
- `framework` (optional): Search within specific Container framework
- `symbolType` (optional): Filter by symbol type (class, protocol, struct, etc.)
- `platform` (optional): Filter by platform (iOS, macOS, etc.)
- `maxResults` (optional): Maximum results (default: 20)

**Examples**:
```json
{"query": "Container*"}
{"query": "*Service", "framework": "ContainerImagesService"}
```

### Apple Containerization Documentation

#### `list_containerization_technologies`
Browse all available Apple Containerization frameworks and technologies.

#### `get_containerization_documentation`
Get detailed documentation for Apple Containerization symbols or frameworks.
- `path` (required): Containerization documentation path (e.g., "documentation/ContainerizationArchive") or framework name

**Examples**:
```json
{"path": "ContainerizationArchive"}
{"path": "documentation/ContainerizationArchive/ArchiveAPI"}
```

#### `search_containerization_symbols`
Search for symbols across Apple Containerization frameworks with advanced filtering.
- `query` (required): Search query with wildcard support
- `framework` (optional): Search within specific Containerization framework
- `symbolType` (optional): Filter by symbol type (class, protocol, struct, etc.)
- `platform` (optional): Filter by platform (iOS, macOS, etc.)
- `maxResults` (optional): Maximum results (default: 20)

**Examples**:
```json
{"query": "Archive*"}
{"query": "*Service", "framework": "ContainerizationArchive"}
```

### Utility Tools

#### `check_updates`
Check for available updates from the git repository.
- No parameters required
- Shows current branch status, available updates, and update instructions
- **Note**: The server automatically checks for updates on startup and displays notifications

## 🚨 Troubleshooting

**Server Won't Start**
- Ensure Node.js 18+ is installed
- Verify the path in your MCP config points to the correct `dist/index.js` location
- Check your MCP configuration syntax
- Restart your AI assistant after config changes

**"0 tools" Showing Up**
- This usually means the server isn't starting properly
- Check the file path in your configuration is correct and absolute
- The `dist` directory is included - no build step required
- Try testing the server directly: `node /path/to/apple-doc-mcp/dist/index.js`

**No Results Found**
- Try broader search terms
- Use wildcard patterns: `"*View*"` instead of `"View"`
- Remove filters to expand search scope

**Performance Issues**
- First search may be slower (builds cache)
- Subsequent searches are much faster
- Reduce `maxResults` for faster responses

## ⚙️ Technical Details

- **10-minute caching** to avoid API rate limits
- **15-second timeouts** for reliable performance
- **Smart framework prioritization** for faster searches
- **Graceful error handling** for robust operation

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **Memory**: ~50MB RAM during operation
- **Network**: Internet connection to Apple's documentation API

## 🤝 Contributing

Found a bug or want to add a feature? Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.
