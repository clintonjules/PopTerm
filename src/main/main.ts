import { app, BrowserWindow, ipcMain, globalShortcut, screen, Menu, nativeTheme, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as fs from 'fs';


app.setName('PopTerm');
app.name = 'PopTerm';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
const DEFAULT_HEIGHT = 45;
const DEFAULT_WIDTH = 500;
const EXPANDED_HEIGHT = 200;
let isExpanded = false;
let currentWorkingDirectory = os.homedir();


const defaultSettings = {
  theme: 'system',
  position: 'center'
};


let appSettings = { ...defaultSettings };


function positionWindow(win: BrowserWindow) {
  const { width, height } = win.getBounds();
  const screenBounds = screen.getPrimaryDisplay().workAreaSize;
  
  const padding = 20; 
  
  let x, y;
  
  switch (appSettings.position) {
    case 'top-center':
      x = Math.round((screenBounds.width - width) / 2);
      y = padding;
      break;
    case 'top-right':
      x = screenBounds.width - width - padding;
      y = padding;
      break;
    case 'top-left':
      x = padding;
      y = padding;
      break;
    case 'bottom-center':
      x = Math.round((screenBounds.width - width) / 2);
      y = screenBounds.height - height - padding;
      break;
    case 'bottom-right':
      x = screenBounds.width - width - padding;
      y = screenBounds.height - height - padding;
      break;
    case 'bottom-left':
      x = padding;
      y = screenBounds.height - height - padding;
      break;
    case 'center-right':
      x = screenBounds.width - width - padding;
      y = Math.round((screenBounds.height - height) / 2);
      break;
    case 'center-left':
      x = padding;
      y = Math.round((screenBounds.height - height) / 2);
      break;
    case 'center':
    default:
      x = Math.round((screenBounds.width - width) / 2);
      y = Math.round((screenBounds.height - height) / 2);
      break;
  }
  
  win.setPosition(x, y);
}


function loadSettings() {
  try {
    if (fs.existsSync(path.join(app.getPath('userData'), 'settings.json'))) {
      const settingsData = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8');
      const savedSettings = JSON.parse(settingsData);
      appSettings = { ...defaultSettings, ...savedSettings };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}


function saveSettings(settings: any) {
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings));
    appSettings = { ...settings };
    
    
    if (mainWindow) {
      positionWindow(mainWindow);
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

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

  if (mainWindow) {
    mainWindow.setMaximumSize(30000, DEFAULT_HEIGHT);
    
    
    positionWindow(mainWindow);
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  createApplicationMenu();
}

function createNewWindowIfNotExists(): BrowserWindow {
  if (!mainWindow) {
    createWindow();
  } else if (!mainWindow.isVisible()) {
    mainWindow.show();
    
    positionWindow(mainWindow);
    mainWindow.focus();
  } else {
    mainWindow.focus();
  }
  
  return mainWindow!;
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const isDarkMode = nativeTheme.shouldUseDarkColors;
  
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 400,
    title: '',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: true,
    minimizable: true,
    maximizable: true,
    frame: true,
    titleBarStyle: 'default',
    parent: mainWindow || undefined,
    modal: false,
    show: false,
    backgroundColor: isDarkMode ? '#222222' : '#f5f5f5',
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  
  settingsWindow.once('ready-to-show', () => {
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  });
  
  
  const settingsMenu = Menu.buildFromTemplate([
    {
      label: 'Options',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (settingsWindow) {
              settingsWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ]);
  
  settingsWindow.setMenu(settingsMenu);
  
  settingsWindow.on('close', (e) => {
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'PopTerm', 
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow();
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createNewWindowIfNotExists();
          }
        },
        {
          label: 'Clear Terminal',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('clear-terminal');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) {
              mainWindow.hide();
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Output',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-output');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('zoom-in');
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('zoom-out');
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('zoom-reset');
            }
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/clintonjules/PopTerm');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  
  loadSettings();
  
  createWindow();
  
  
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Alt+T', () => {
    createNewWindowIfNotExists();
  });
  
  if (!shortcutRegistered) {
    console.error('Global shortcut registration failed');
  } else {
    console.log('Global shortcut registered: CommandOrControl+Alt+T');
  }
  
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
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('execute-command', (event, command: string) => {
  const trimmedCommand = command.trim();
  
  if (trimmedCommand.startsWith('cd ')) {
    const targetDir = trimmedCommand.substring(3).trim();
    let newDir = targetDir;
    
    if (!path.isAbsolute(targetDir)) {
      if (targetDir === '~') {
        newDir = os.homedir();
      } else if (targetDir === '-') {
        event.reply('command-output', { output: "cd - not implemented\n", type: 'stderr' });
        event.reply('command-complete', { code: 1, stdout: '', stderr: "cd - not implemented\n" });
        return;
      } else if (targetDir === '..') {
        newDir = path.dirname(currentWorkingDirectory);
      } else if (targetDir === '.') {
        newDir = currentWorkingDirectory;
      } else {
        newDir = path.join(currentWorkingDirectory, targetDir);
      }
    }
    
    if (newDir.startsWith('~')) {
      newDir = newDir.replace('~', os.homedir());
    }
    
    try {
      const stats = fs.statSync(newDir);
      if (stats.isDirectory()) {
        currentWorkingDirectory = newDir;
        event.reply('command-output', { output: "", type: 'stdout' });
        event.reply('command-complete', { code: 0, stdout: '', stderr: '' });
        
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
  
  const shell = process.platform === 'win32' ? 
    'powershell.exe' : 
    process.env.SHELL || '/bin/bash';
  
  let spawnOptions;
  let spawnCommand;
  let spawnArgs;
  
  const hasRedirection = /[><|]/.test(command);
  
  if (process.platform === 'win32') {
    spawnCommand = shell;
    spawnArgs = ['-Command', command];
    spawnOptions = {
      cwd: currentWorkingDirectory,
      env: { ...process.env },
      shell: true
    };
  } else {
    spawnCommand = shell;
    
    if (hasRedirection) {
      spawnArgs = ['-c', command];
      spawnOptions = {
        cwd: currentWorkingDirectory,
        env: { ...process.env },
        shell: true
      };
    } else {
      spawnArgs = ['-c', command];
      spawnOptions = {
        cwd: currentWorkingDirectory,
        env: { ...process.env },
        shell: false
      };
    }
  }
  
  console.log(`Executing: ${spawnCommand} ${spawnArgs.join(' ')}`);
  console.log(`In directory: ${currentWorkingDirectory}`);
  console.log(`Using shell: ${spawnOptions.shell ? 'true' : 'false'}`);
  
  const termProcess = child_process.spawn(spawnCommand, spawnArgs, spawnOptions);
  
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

  termProcess.on('error', (error) => {
    const errorMessage = `Error executing command: ${error.message}\n`;
    stderr += errorMessage;
    event.reply('command-output', { output: errorMessage, type: 'stderr' });
    event.reply('command-complete', { code: 1, stdout, stderr });
  });

  termProcess.on('close', (code) => {
    if (code === 0 && !command.startsWith('cd ')) {
      try {
        const pwdProcess = child_process.spawnSync(shell, ['-c', 'pwd'], {
          cwd: currentWorkingDirectory,
          encoding: 'utf8'
        });
        
        if (pwdProcess.status === 0 && pwdProcess.stdout) {
          const newDir = pwdProcess.stdout.trim();
          if (newDir && newDir !== currentWorkingDirectory) {
            currentWorkingDirectory = newDir;
            event.reply('directory-changed', currentWorkingDirectory);
          }
        }
      } catch (error) {
        console.error('Error checking pwd:', error);
      }
    }
    
    event.reply('command-complete', { code, stdout, stderr });
  });
});

ipcMain.on('toggle-expand', (event, expanded: boolean) => {
  if (!mainWindow) return;
  
  const [width, height] = mainWindow.getSize();
  
  if (expanded === isExpanded) return;
  
  isExpanded = expanded;
  
  if (expanded) {
    mainWindow.setMaximumSize(30000, 30000);
    
    const newHeight = Math.max(EXPANDED_HEIGHT, height);
    mainWindow.setSize(width, newHeight, true);
  } else {
    mainWindow.setSize(width, DEFAULT_HEIGHT, true);
    
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.setMaximumSize(30000, DEFAULT_HEIGHT);
      }
    }, 100);
  }
});

ipcMain.on('tab-complete', (event, inputText: string) => {
  try {
    const lastWord = inputText.split(/\s+/).pop() || '';
    
    if (!lastWord.trim()) {
      event.reply('tab-complete-result', { matches: [], originalInput: inputText });
      return;
    }
    
    let basePath = currentWorkingDirectory;
    let searchPattern = lastWord;
    
    if (lastWord.startsWith('~/')) {
      basePath = os.homedir();
      searchPattern = lastWord.substring(2);
    } else if (lastWord === '~') {
      basePath = os.homedir();
      searchPattern = '';
    }
    
    if (path.isAbsolute(lastWord)) {
      basePath = path.dirname(lastWord);
      searchPattern = path.basename(lastWord);
    } 
    else if (lastWord.includes('/')) {
      const lastSlashIndex = lastWord.lastIndexOf('/');
      const dirPart = lastWord.substring(0, lastSlashIndex);
      searchPattern = lastWord.substring(lastSlashIndex + 1);
      
      if (dirPart.startsWith('~/')) {
        basePath = path.join(os.homedir(), dirPart.substring(2));
      } else {
        basePath = path.join(currentWorkingDirectory, dirPart);
      }
    }
    
    const files = fs.readdirSync(basePath);
    
    const matches = files.filter(file => file.startsWith(searchPattern));
    
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
    console.error('Tab completion error:', error);
    event.reply('tab-complete-result', { matches: [], originalInput: inputText });
  }
});

ipcMain.on('settings-updated', (event, settings) => {
  
  saveSettings(settings);
  
  
  if (mainWindow) {
    mainWindow.webContents.send('settings-updated', settings);
  }
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('create-or-show-window', () => {
  createNewWindowIfNotExists();
});

ipcMain.on('settings-close-attempted', (event) => {
  if (!settingsWindow) return;
  
  const options = {
    type: 'question' as const,
    buttons: ['Discard Changes', 'Cancel'],
    defaultId: 0,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to discard them?',
    detail: 'Your changes will be lost if you don\'t save them.',
    cancelId: 1,
    noLink: true
  };
  
  dialog.showMessageBox(settingsWindow, options).then((result) => {
    if (result.response === 0) {
      event.sender.send('settings-close-confirmed');
    }
  });
});


ipcMain.on('get-settings', (event) => {
  event.reply('settings-response', appSettings);
}); 