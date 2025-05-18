# PopTerm

A modern, minimal popup terminal interface built with Electron, React, and TypeScript, currently available for macOS with Linux and Windows support coming soon.

## Features

- Clean, minimal UI with just a command input
- Output is only shown when needed and can be expanded/collapsed
- Compact, transparent, borderless window that can be dragged anywhere
- Dark and light mode support with system theme detection
- Tab completion for commands and file paths
- Command history navigation with arrow keys
- Configurable settings
- Global shortcut to toggle the terminal window visibility
- Remembers last window position within a session
- Cross-platform compatibility (macOS support, Linux and Windows coming soon)
- Zoom in/out functionality for better readability
- Remembers current working directory between commands

## Settings

PopTerm offers a settings window where you can customize:

- Theme (Light, Dark, or System)
- Show/hide settings icon in terminal

All settings are saved automatically between sessions.

## Keyboard Shortcuts

- **Cmd/Ctrl+T**: Toggle terminal window (show/hide)
- **Cmd/Ctrl+K**: Clear terminal
- **Cmd/Ctrl+O**: Toggle output display
- **Cmd/Ctrl+=**: Zoom in
- **Cmd/Ctrl+-**: Zoom out
- **Cmd/Ctrl+0**: Reset zoom
- **Tab**: Complete command or path
- **Up/Down arrows**: Navigate command history
- **Custom Global Shortcut**: Toggle PopTerm visibility (configurable in settings)

> Note: On macOS, "Ctrl" is shown as "Cmd" and "Alt" is shown as "Option" in the application interface.

## Usage

- Type a command and press Enter to execute it
- Press Tab for autocomplete suggestions
- Use the arrow button to expand/collapse the output area
- Click the gear icon to access settings
- The terminal handles directory changes (`cd` commands) and maintains context between commands

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm

### Setup

1. Clone the repository:
```
git clone https://github.com/clintonjules/PopTerm.git
cd PopTerm
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

This will create distributables for macOS  (Windows and Linu coming soon) in the `dist` directory.

## How It Works

PopTerm provides a simple interface to your system's native terminal:

1. Enter a command in the input field and press Enter
2. The command is sent to your system's shell (bash/zsh on macOS and Linux, PowerShell/CMD on Windows)
3. Click the down arrow to expand the output area and see the results
4. Click the arrow again to collapse the output and return to the minimal interface
5. The current working directory is tracked between commands

## Technical Details

- Built with Electron for cross-platform desktop capabilities
- React with TypeScript for UI components and type safety
- Styled Components for theming and styling
- IPC communication between Electron main and renderer processes
- Tab completion with visual dropdown menu using subtle grey highlighting