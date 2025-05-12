import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
const DEFAULT_HEIGHT = 45;
const DEFAULT_WIDTH = 500;
const EXPANDED_HEIGHT = 200;
let isExpanded = false;
// Track the current working directory
let currentWorkingDirectory = os.homedir();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: true,
    alwaysOnTop: true,
    minHeight: DEFAULT_HEIGHT,
    minWidth: 300,
  });

  // Initially, lock the height
  if (mainWindow) {
    mainWindow.setMaximumSize(30000, DEFAULT_HEIGHT);
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // For development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Register keyboard shortcuts
  globalShortcut.register('CommandOrControl+Q', () => {
    app.quit();
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.setAboutPanelOptions({
  applicationName: 'PopTerm',
  applicationVersion: '1.0.0',
  credits: 'Built with Electron, React, and TypeScript',
  website: 'https://github.com/clintonjules/PopTerm' 
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle terminal commands
ipcMain.on('execute-command', (event, command: string) => {
  const trimmedCommand = command.trim();
  
  // Handle cd command specially
  if (trimmedCommand.startsWith('cd ')) {
    const targetDir = trimmedCommand.substring(3).trim();
    let newDir = targetDir;
    
    // Handle relative paths
    if (!path.isAbsolute(targetDir)) {
      if (targetDir === '~') {
        newDir = os.homedir();
      } else if (targetDir === '-') {
        // Not implementing cd - history for now
        event.reply('command-output', { output: "cd - not implemented\n", type: 'stderr' });
        event.reply('command-complete', { code: 1, stdout: '', stderr: "cd - not implemented\n" });
        return;
      } else {
        newDir = path.join(currentWorkingDirectory, targetDir);
      }
    }
    
    // Check if directory exists
    try {
      const stats = fs.statSync(newDir);
      if (stats.isDirectory()) {
        currentWorkingDirectory = newDir;
        event.reply('command-output', { output: "", type: 'stdout' });
        event.reply('command-complete', { code: 0, stdout: '', stderr: '' });
        
        // Send the new directory to the renderer
        event.reply('directory-changed', currentWorkingDirectory);
        return;
      } else {
        event.reply('command-output', { output: `Not a directory: ${targetDir}\n`, type: 'stderr' });
        event.reply('command-complete', { code: 1, stdout: '', stderr: `Not a directory: ${targetDir}\n` });
        return;
      }
    } catch (error) {
      event.reply('command-output', { output: `No such directory: ${targetDir}\n`, type: 'stderr' });
      event.reply('command-complete', { code: 1, stdout: '', stderr: `No such directory: ${targetDir}\n` });
      return;
    }
  }
  
  // For all other commands
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const shellArgs = process.platform === 'win32' ? ['-Command'] : ['-c'];
  
  const termProcess = child_process.spawn(shell, [...shellArgs, command], {
    shell: true,
    cwd: currentWorkingDirectory,
  });
  
  let stdout = '';
  let stderr = '';

  termProcess.stdout.on('data', (data) => {
    stdout += data.toString();
    event.reply('command-output', { output: data.toString(), type: 'stdout' });
  });

  termProcess.stderr.on('data', (data) => {
    stderr += data.toString();
    event.reply('command-output', { output: data.toString(), type: 'stderr' });
  });

  termProcess.on('close', (code) => {
    event.reply('command-complete', { code, stdout, stderr });
  });
});

// Handle window expansion/collapse
ipcMain.on('toggle-expand', (event, expanded: boolean) => {
  if (!mainWindow) return;
  
  const [width, height] = mainWindow.getSize();
  
  // If state hasn't changed, do nothing
  if (expanded === isExpanded) return;
  
  isExpanded = expanded;
  
  if (expanded) {
    // Remove height restriction
    mainWindow.setMaximumSize(30000, 30000);
    
    // Set a reasonable expanded height for initial expansion
    const newHeight = Math.max(EXPANDED_HEIGHT, height);
    mainWindow.setSize(width, newHeight);
  } else {
    // Return to default height
    mainWindow.setSize(width, DEFAULT_HEIGHT);
    
    // Set timeout to ensure resize happens before restricting resizing
    setTimeout(() => {
      if (mainWindow) {
        // Only allow horizontal resizing when collapsed
        mainWindow.setMaximumSize(30000, DEFAULT_HEIGHT);
      }
    }, 100);
  }
});

// Handle tab completion
ipcMain.on('tab-complete', (event, inputText: string) => {
  try {
    // Parse the input to find what we're trying to complete
    const lastWord = inputText.split(/\s+/).pop() || '';
    
    // If it's empty or just whitespace, return early
    if (!lastWord.trim()) {
      event.reply('tab-complete-result', { matches: [], originalInput: inputText });
      return;
    }
    
    // Determine if we're completing a path or a command
    let basePath = currentWorkingDirectory;
    let searchPattern = lastWord;
    
    // Handle home directory shorthand
    if (lastWord.startsWith('~/')) {
      basePath = os.homedir();
      searchPattern = lastWord.substring(2);
    } else if (lastWord === '~') {
      basePath = os.homedir();
      searchPattern = '';
    }
    
    // Handle absolute paths
    if (path.isAbsolute(lastWord)) {
      basePath = path.dirname(lastWord);
      searchPattern = path.basename(lastWord);
    } 
    // Handle relative paths with directories
    else if (lastWord.includes('/')) {
      const lastSlashIndex = lastWord.lastIndexOf('/');
      const dirPart = lastWord.substring(0, lastSlashIndex);
      searchPattern = lastWord.substring(lastSlashIndex + 1);
      
      // Resolve the directory part
      if (dirPart.startsWith('~/')) {
        basePath = path.join(os.homedir(), dirPart.substring(2));
      } else {
        basePath = path.join(currentWorkingDirectory, dirPart);
      }
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(basePath);
    
    // Filter files that match our search pattern
    const matches = files.filter(file => file.startsWith(searchPattern));
    
    // Add trailing slash to directories
    const matchesWithTypes = matches.map(match => {
      const fullPath = path.join(basePath, match);
      try {
        const stats = fs.statSync(fullPath);
        return {
          name: match,
          isDirectory: stats.isDirectory()
        };
      } catch (error) {
        return {
          name: match,
          isDirectory: false
        };
      }
    });
    
    event.reply('tab-complete-result', { 
      matches: matchesWithTypes, 
      originalInput: inputText,
      lastWord
    });
  } catch (error) {
    // If there's any error, just return no matches
    console.error('Tab completion error:', error);
    event.reply('tab-complete-result', { matches: [], originalInput: inputText });
  }
}); 