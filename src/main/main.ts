import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';

let mainWindow: BrowserWindow | null = null;
const DEFAULT_HEIGHT = 45;
const DEFAULT_WIDTH = 500;
const EXPANDED_HEIGHT = 300;
let isExpanded = false;

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
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const shellArgs = process.platform === 'win32' ? ['-Command'] : ['-c'];
  
  const termProcess = child_process.spawn(shell, [...shellArgs, command], {
    shell: true,
    cwd: os.homedir(),
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