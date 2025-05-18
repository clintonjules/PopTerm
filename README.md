# PopTerm

A modern, minimal popup terminal interface built with Electron, React, and TypeScript, currently available for macOS with Linux and Windows support coming soon.

## Features

- Clean, minimal UI with just a command input
- Output is only shown when needed and can be expanded/collapsed
- Compact, transparent, borderless window that can be dragged anywhere
- Native menu integration across all platforms
- Dark and light mode support with system theme detection and real-time synchronization
- Tab completion for commands and file paths
- Command history navigation with arrow keys
- Configurable settings with instant application
- Global shortcut to toggle the terminal window visibility
- Remembers last window position within a session
- Cross-platform compatibility (macOS support, Linux and Windows coming soon)

## Settings

PopTerm offers a settings window where you can customize:

- Theme (Light, Dark, or System)
- Window Position (9 different positions on screen)
- Global Shortcut (customizable keyboard combination)

All settings are applied instantly without requiring a save button. The theme is always synchronized between all application windows in real-time.

Access the settings through:
- The PopTerm menu in the menu bar (Preferences option)
- Keyboard shortcut: Cmd+, (macOS) or Ctrl+, (Linux/Windows)

## Keyboard Shortcuts

- **Cmd/Ctrl+,**: Open settings
- **Cmd/Ctrl+K**: Clear terminal
- **Cmd/Ctrl+T**: Toggle terminal window (show/hide)
- **Cmd/Ctrl+Q**: Quit the application
- **Cmd/Ctrl+O**: Toggle output display
- **Cmd/Ctrl+=**: Zoom in
- **Cmd/Ctrl+-**: Zoom out
- **Cmd/Ctrl+0**: Reset zoom
- **Tab**: Complete command or path
- **Up/Down arrows**: Navigate command history
- **Custom Global Shortcut**: Toggle PopTerm visibility (configurable in settings)

> Note: On macOS, "Ctrl" is shown as "Cmd" and "Alt" is shown as "Option" in the application interface.

## Usage

- Only one terminal window is active at a time. Toggling the terminal will show or hide this window.
- The window always reappears at the last position it was hidden during the session.
- The terminal window is always on top and can be quickly accessed from anywhere using the global shortcut.

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
- IPC communication between Electron main and renderer processes for real-time theme synchronization
- Native menu integration across all supported platforms
- Platform-specific optimizations for macOS, Linux, and Windows
- Global shortcut registration for quick access from anywhere