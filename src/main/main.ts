import { app, BrowserWindow, ipcMain, globalShortcut, screen, Menu, nativeTheme, dialog, Tray, nativeImage } from 'electron';
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
let lastWindowPosition: { x: number, y: number } | null = null;
let tray: Tray | null = null;
let trayContextMenu: Menu | null = null;
let isExplicitlyQuitting = false;

const defaultSettings = {
  theme: 'system',
  position: 'center',
  showSettingsIcon: true,
  shortcut: {
    control: true,
    alt: true,
    shift: false,
    key: 'T'
  }
};

let appSettings = { ...defaultSettings };
let registeredShortcut: string | null = null;

function positionWindow(win: BrowserWindow) {
  const { width, height } = win.getBounds();
  const point = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(point);
  const screenBounds = currentDisplay.workArea;
  const padding = 20;
  let x, y;
  
  switch (appSettings.position) {
    case 'top-center':
      x = Math.round(screenBounds.x + (screenBounds.width - width) / 2);
      y = screenBounds.y + padding;
      break;
    case 'top-right':
      x = screenBounds.x + screenBounds.width - width - padding;
      y = screenBounds.y + padding;
      break;
    case 'top-left':
      x = screenBounds.x + padding;
      y = screenBounds.y + padding;
      break;
    case 'bottom-center':
      x = Math.round(screenBounds.x + (screenBounds.width - width) / 2);
      y = screenBounds.y + screenBounds.height - height - padding;
      break;
    case 'bottom-right':
      x = screenBounds.x + screenBounds.width - width - padding;
      y = screenBounds.y + screenBounds.height - height - padding;
      break;
    case 'bottom-left':
      x = screenBounds.x + padding;
      y = screenBounds.y + screenBounds.height - height - padding;
      break;
    case 'center-right':
      x = screenBounds.x + screenBounds.width - width - padding;
      y = Math.round(screenBounds.y + (screenBounds.height - height) / 2);
      break;
    case 'center-left':
      x = screenBounds.x + padding;
      y = Math.round(screenBounds.y + (screenBounds.height - height) / 2);
      break;
    case 'center':
    default:
      x = Math.round(screenBounds.x + (screenBounds.width - width) / 2);
      y = Math.round(screenBounds.y + (screenBounds.height - height) / 2);
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
      registerGlobalShortcut();
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function saveSettings(settings: any) {
  try {
    const positionChanged = settings.position !== appSettings.position;
    
    fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings));
    appSettings = { ...settings };
    
    if (mainWindow && mainWindow.isVisible() && positionChanged) {
      positionWindow(mainWindow);
    }
    
    registerGlobalShortcut();
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function registerGlobalShortcut() {
  if (registeredShortcut) {
    globalShortcut.unregister(registeredShortcut);
    registeredShortcut = null;
  }
  
  const { shortcut } = appSettings;
  if (!shortcut || !shortcut.key) return;
  
  const modifiers = [];
  if (shortcut.control) modifiers.push('CommandOrControl');
  if (shortcut.alt) modifiers.push('Alt');
  if (shortcut.shift) modifiers.push('Shift');
  
  if (modifiers.length === 0 || !shortcut.key) {
    console.log('No valid shortcut configuration provided');
    return;
  }
  
  const accelerator = [...modifiers, shortcut.key].join('+');
  registeredShortcut = accelerator;
  
  const shortcutRegistered = globalShortcut.register(accelerator, () => {
    if (mainWindow && mainWindow.isVisible()) {
      lastWindowPosition = { x: mainWindow.getPosition()[0], y: mainWindow.getPosition()[1] };
      mainWindow.hide();
    } else {
      toggleTerminalWindow();
    }
  });
  
  const isMac = process.platform === 'darwin';
  const displayAccelerator = accelerator
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Alt', isMac ? 'Option' : 'Alt');
  
  if (!shortcutRegistered) {
    console.error(`Global shortcut registration failed: ${displayAccelerator}`);
  } else {
    console.log(`Global shortcut registered: ${displayAccelerator}`);
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
    minWidth: 350,
    skipTaskbar: true,
    focusable: true,
    hasShadow: true,
    fullscreenable: false,
    acceptFirstMouse: true,
    type: 'panel',
    show: false,
    x: screen.getCursorScreenPoint().x - DEFAULT_WIDTH / 2,
    y: screen.getCursorScreenPoint().y - DEFAULT_HEIGHT / 2
  });

  if (mainWindow) {
    mainWindow.setMaximumSize(30000, DEFAULT_HEIGHT);
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } else {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    positionWindow(mainWindow);
    
    lastWindowPosition = { x: mainWindow.getPosition()[0], y: mainWindow.getPosition()[1] };
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      const isDarkTheme = appSettings.theme === 'dark' || 
                         (appSettings.theme === 'system' && nativeTheme.shouldUseDarkColors);
      mainWindow.webContents.send('theme-changed', appSettings.theme);
      mainWindow.webContents.send('system-theme-changed', isDarkTheme ? 'dark' : 'light');
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  mainWindow.on('close', (event) => {
    if (isExplicitlyQuitting) {
      return;
    }
    if (mainWindow && mainWindow.isVisible()) {
      event.preventDefault();
      lastWindowPosition = { x: mainWindow.getPosition()[0], y: mainWindow.getPosition()[1] };
      mainWindow.hide();
    }
  });
  
  mainWindow.setMenuBarVisibility(true);
  mainWindow.setAutoHideMenuBar(false);
  refreshMenus();
}

function toggleTerminalWindow(): BrowserWindow {
  if (!mainWindow) {
    createWindow();
  } else if (!mainWindow.isVisible()) {
    if (lastWindowPosition) {
      const point = screen.getCursorScreenPoint();
      const currentDisplay = screen.getDisplayNearestPoint(point);
      const screenBounds = currentDisplay.workArea;
      
      if (lastWindowPosition.x >= screenBounds.x && 
          lastWindowPosition.x <= screenBounds.x + screenBounds.width - DEFAULT_WIDTH &&
          lastWindowPosition.y >= screenBounds.y && 
          lastWindowPosition.y <= screenBounds.y + screenBounds.height - DEFAULT_HEIGHT) {
        mainWindow.setPosition(lastWindowPosition.x, lastWindowPosition.y);
      } else {
        positionWindow(mainWindow);
      }
    } else {
      positionWindow(mainWindow);
    }
    
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } else {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    
    const isDarkTheme = appSettings.theme === 'dark' || 
                       (appSettings.theme === 'system' && nativeTheme.shouldUseDarkColors);
    mainWindow.webContents.send('theme-changed', appSettings.theme);
    mainWindow.webContents.send('system-theme-changed', isDarkTheme ? 'dark' : 'light');
    mainWindow.show();
    mainWindow.focus();
  } else {
    if (mainWindow) {
      lastWindowPosition = { x: mainWindow.getPosition()[0], y: mainWindow.getPosition()[1] };
      mainWindow.hide();
    }
  }
  return mainWindow!;
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const isDarkTheme = appSettings.theme === 'dark' || 
                     (appSettings.theme === 'system' && nativeTheme.shouldUseDarkColors);
  
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 315,
    title: '',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: true,
    titleBarStyle: 'default',
    show: false,
    alwaysOnTop: true,
    backgroundColor: isDarkTheme ? '#222222' : '#f5f5f5',
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  
  if (process.platform === 'darwin') {
    settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    settingsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  }
  
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
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function generateApplicationMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'PopTerm', 
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
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
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow && mainWindow.isVisible()) {
              lastWindowPosition = { x: mainWindow.getPosition()[0], y: mainWindow.getPosition()[1] };
              mainWindow.hide();
            } else {
              toggleTerminalWindow();
            }
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
          label: isExpanded ? 'Close Output' : 'Expand Output',
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
  return template;
}

function generateTrayContextMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
    { label: 'Toggle Terminal', click: () => toggleTerminalWindow() },
    {
      label: 'Clear Terminal',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('clear-terminal');
        }
      }
    },
    {
      label: isExpanded ? 'Close Output' : 'Expand Output', 
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-output');
        }
      }
    },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { 
      label: 'Quit PopTerm', 
      click: () => {
        isExplicitlyQuitting = true;
        app.quit();
      } 
    }
  ];
}

function refreshMenus() {
  const appMenuTemplate = generateApplicationMenuTemplate();
  const appMenu = Menu.buildFromTemplate(appMenuTemplate);
  Menu.setApplicationMenu(appMenu);
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(true);
    mainWindow.setAutoHideMenuBar(false);
  }

  if (tray) {
    const trayMenuTemplate = generateTrayContextMenuTemplate();
    trayContextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    tray.setContextMenu(trayContextMenu);
  }
}

app.whenReady().then(() => {
  loadSettings();
  
  if (app.dock) {
    app.dock.hide();
  }

  createWindow();
  
  const iconName = process.platform === 'darwin' ? 'iconTemplate.png' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    

    if (process.platform === 'darwin') {
      icon = icon.resize({ width: 16, height: 16 });
      icon.setTemplateImage(true);
    }
    
    if (icon.isEmpty()) {
      console.warn(`Tray icon file is empty or not found at ${iconPath}.`);
      if (process.platform === 'darwin') {
        console.log('Attempting to use a macOS system template image as fallback for tray.');
        icon = nativeImage.createFromNamedImage('NSTouchBarUser');

        icon = icon.resize({ width: 16, height: 16 });
        icon.setTemplateImage(true);
      }
      if (icon.isEmpty()) {
        console.error('Failed to load tray icon and macOS fallback. Tray icon will be invisible or default.');
        icon = nativeImage.createEmpty();
      }
    }
  } catch (error) {
    console.error('Error creating tray icon from path:', error);
    if (process.platform === 'darwin') {
        icon = nativeImage.createFromNamedImage('NSTouchBarUser');

        icon = icon.resize({ width: 16, height: 16 });
        icon.setTemplateImage(true);
    }
    if (!icon || icon.isEmpty()) {
        icon = nativeImage.createEmpty();
    }
  }

  tray = new Tray(icon);

  tray.setToolTip('PopTerm');
  tray.on('click', () => {
    if (process.platform === 'darwin') {
      if (trayContextMenu) {
        tray?.popUpContextMenu(trayContextMenu);
      }
    } else {
      toggleTerminalWindow();
    }
  });
  
  refreshMenus();

  nativeTheme.on('updated', () => {
    if (appSettings.theme === 'system') {
      const isDarkTheme = nativeTheme.shouldUseDarkColors;
      
      if (settingsWindow) {
        settingsWindow.setBackgroundColor(isDarkTheme ? '#222222' : '#f5f5f5');
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('system-theme-changed', isDarkTheme ? 'dark' : 'light');
      }
      if (settingsWindow) {
        settingsWindow.webContents.send('system-theme-changed', isDarkTheme ? 'dark' : 'light');
      }
    }
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isVisible()) {
      toggleTerminalWindow();
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
  if (registeredShortcut) {
    globalShortcut.unregister(registeredShortcut);
    registeredShortcut = null;
  }
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('execute-command', (event, command: string) => {
  const trimmedCommand = command.trim();
  
  if (trimmedCommand === 'cd' || trimmedCommand.startsWith('cd ')) {
    let targetDir = '';
    
    if (trimmedCommand === 'cd') {
      targetDir = '~';
    } else {
      targetDir = trimmedCommand.substring(3).trim();
    }
    
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
  refreshMenus();
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

ipcMain.on('theme-changed', (event, theme) => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', theme);
  }
  
  if (settingsWindow) {
    const isDarkTheme = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);
    settingsWindow.setBackgroundColor(isDarkTheme ? '#222222' : '#f5f5f5');
  }
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('create-or-show-window', () => {
  toggleTerminalWindow();
});

ipcMain.on('get-settings', (event) => {
  event.reply('settings-response', appSettings);
}); 