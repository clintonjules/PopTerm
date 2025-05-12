# PopTerm

A modern, minimal popup terminal interface built with Electron, React, and TypeScript.

## Features

- Clean, minimal UI with just a command input
- Output is only shown when the user clicks the down arrow
- Compact, transparent, borderless window that can be dragged anywhere
- Cross-platform support (macOS, Windows, Linux)
- Keyboard shortcuts (Cmd/Ctrl+Q to quit)

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm

### Setup

1. Clone the repository:
```
git clone https://github.com/yourusername/popterm.git
cd popterm
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm run dev
```

### Building

To build the application for production:

```
npm run build
```

### Packaging

To package the application for distribution:

```
npm run package
```

This will create distributables for macOS, Windows, and Linux in the `dist` directory.

## How It Works

PopTerm provides a simple interface to your system's native terminal:

1. Enter a command in the input field and press Enter
2. The command is sent to your system's shell (bash on macOS/Linux, PowerShell on Windows)
3. Click the down arrow to expand the output area and see the results
4. Click the arrow again to collapse the output and return to the minimal interface