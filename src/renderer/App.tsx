import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import styled, { createGlobalStyle, css, ThemeProvider } from 'styled-components';
import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as os from 'os';

enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

interface Settings {
  theme: Theme;
  showSettingsIcon?: boolean;
}

const GlobalStyle = createGlobalStyle<{ $scale: number; $theme: Theme }>`
  :root {
    --bg-color: ${props => props.$theme === Theme.LIGHT ? 'rgba(240, 240, 240, 0.8)' : 'rgba(30, 30, 30, 0.8)'};
    --bg-color-translucent: ${props => props.$theme === Theme.LIGHT ? 'rgba(240, 240, 240, 0.5)' : 'rgba(30, 30, 30, 0.5)'};
    --border-color: ${props => props.$theme === Theme.LIGHT ? '#ccc' : '#444'};
    --text-color: ${props => props.$theme === Theme.LIGHT ? '#333' : '#ddd'};
    --accent-color: ${props => props.$theme === Theme.LIGHT ? '#4a8f69' : '#6adf91'};
    --error-color: ${props => props.$theme === Theme.LIGHT ? '#e74c3c' : '#ff6b6b'};
    --scale-factor: ${props => props.$scale};
    --font-size-base: calc(14px * var(--scale-factor));
    --font-size-small: calc(12px * var(--scale-factor));
  }
  
  * {
    font-size: var(--font-size-base);
  }
  
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
`;

const SettingsOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const SettingsDialog = styled.div`
  background-color: var(--bg-color);
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SettingsHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SettingsTitle = styled.h2`
  margin: 0;
  color: var(--text-color);
  font-size: 18px;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  
  &:hover {
    color: var(--accent-color);
  }
`;

const SettingsContent = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SettingsGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SettingsLabel = styled.label`
  color: var(--text-color);
  font-weight: bold;
`;

const SettingsInput = styled.input`
  background-color: ${props => props.theme === Theme.LIGHT ? '#fff' : 'rgba(50, 50, 50, 0.8)'};
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 12px;
  border-radius: 4px;
  outline: none;
  
  &:focus {
    border-color: var(--accent-color);
  }
`;

const SettingsSelect = styled.select`
  background-color: ${props => props.theme === Theme.LIGHT ? '#fff' : 'rgba(50, 50, 50, 0.8)'};
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 12px;
  border-radius: 4px;
  outline: none;
  
  &:focus {
    border-color: var(--accent-color);
  }
`;

const SettingsFooter = styled.div`
  padding: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const SettingsButton = styled.button`
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  outline: none;
  -webkit-app-region: no-drag;
  font-size: 25px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-left: 5px;
  min-width: 15px;
  flex-shrink: 0;
  
  &:hover {
    color: var(--accent-color);
  }
`;

const CancelButton = styled(SettingsButton)`
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

interface SettingsDialogProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

const SettingsDialogComponent: React.FC<SettingsDialogProps> = ({ settings, onSave, onClose }) => {
  const [theme, setTheme] = useState(settings.theme);
  const [showSettingsIcon, setShowSettingsIcon] = useState(settings.showSettingsIcon !== false);
  
  const handleSave = () => {
    onSave({
      theme,
      showSettingsIcon
    });
  };
  
  return (
    <SettingsOverlay onClick={e => e.target === e.currentTarget && onClose()}>
      <SettingsDialog>
        <SettingsHeader>
          <SettingsTitle>Settings</SettingsTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </SettingsHeader>
        <SettingsContent>
          <SettingsGroup>
            <SettingsLabel>Theme</SettingsLabel>
            <SettingsSelect 
              value={theme} 
              onChange={e => setTheme(e.target.value as Theme)}
            >
              <option value={Theme.LIGHT}>Light</option>
              <option value={Theme.DARK}>Dark</option>
              <option value={Theme.SYSTEM}>System (follow OS)</option>
            </SettingsSelect>
          </SettingsGroup>
          <SettingsGroup>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={showSettingsIcon}
                onChange={e => setShowSettingsIcon(e.target.checked)}
                id="settings-icon-checkbox"
              />
              <SettingsLabel htmlFor="settings-icon-checkbox">Show settings icon in terminal</SettingsLabel>
            </div>
          </SettingsGroup>
        </SettingsContent>
        <SettingsFooter>
          <CancelButton onClick={onClose}>Cancel</CancelButton>
          <SettingsButton onClick={handleSave}>Save</SettingsButton>
        </SettingsFooter>
      </SettingsDialog>
    </SettingsOverlay>
  );
};

interface DragHandleProps {
  $expanded: boolean;
  theme: Theme;
}

const DragHandle = styled.div<DragHandleProps>`
  width: 15px;
  min-width: 15px;
  max-width: 15px;
  height: 100%;
  background-color: ${props => props.theme === Theme.LIGHT ? 'rgba(200, 200, 200, 0.8)' : 'rgba(50, 50, 50, 0.8)'};
  cursor: grab;
  -webkit-app-region: drag;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  &:hover {
    background-color: ${props => props.theme === Theme.LIGHT ? 'rgba(180, 180, 180, 0.8)' : 'rgba(70, 70, 70, 0.8)'};
  }
  
  &::after {
    content: "";
    width: 2px;
    height: ${props => props.$expanded ? "60px" : "20px"};
    transition: height 0.1s ease;
    background-color: ${props => props.theme === Theme.LIGHT ? '#999' : '#666'};
    border-radius: 4px;
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  background-color: var(--bg-color);
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Menlo', 'Monaco', monospace;
`;


const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  background-color: var(--bg-color);
  
  & > *:first-child {
    flex-shrink: 0;
    flex-grow: 0; 
  }
`;

interface InputContainerProps {
  $expanded: boolean;
}


const AutocompleteContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--bg-color);
  border-top: 1px solid var(--border-color);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
`;

const AutocompleteItem = styled.div<{ $isSelected: boolean }>`
  padding: 6px 12px;
  cursor: pointer;
  color: ${props => props.$isSelected ? '#fff' : 'var(--text-color)'};
  background-color: ${props => props.$isSelected ? 'var(--accent-color)' : 'transparent'};
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:hover {
    background-color: ${props => props.$isSelected ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.2)'};
  }
  
  .directory {
    color: var(--accent-color);
  }
  
  .file {
    color: var(--text-color);
  }
  
  .tab-icon {
    opacity: ${props => props.$isSelected ? 1 : 0};
    font-size: 12px;
    color: ${props => props.$isSelected ? '#fff' : '#999'};
    display: flex;
    align-items: center;
    margin-left: 8px;
  }
  
  .tab-key {
    border: 1px solid ${props => props.$isSelected ? '#fff' : '#666'};
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 10px;
    margin-left: 4px;
  }
`;


const InputContainer = styled.div<InputContainerProps>`
  display: flex;
  align-items: center;
  padding: 8px 12px 9px;
  background-color: var(--bg-color);
  box-shadow: ${props => props.$expanded ? '0 1px 0 var(--border-color)' : 'none'};
  -webkit-app-region: no-drag;
  height: 45px; 
  min-height: 45px; 
  max-height: 45px; 
  box-sizing: border-box;
  position: relative;
  width: 100%;
  overflow: hidden;
`;

const Prompt = styled.span`
  color: var(--accent-color);
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  flex-shrink: 0;
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: var(--font-size-base);
  outline: none;
  font-family: inherit;
  -webkit-app-region: no-drag;
  height: 100%;
  min-height: 20px; 
  max-height: 20px; 
  line-height: normal;
  vertical-align: middle;
  padding: 0;
  caret-color: var(--accent-color);
  margin-right: 8px;
  text-overflow: ellipsis;
  
  &::placeholder {
    color: var(--text-color);
    opacity: 0.5;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  margin-left: auto;
  min-width: 40px;
  justify-content: flex-end;
`;

interface ToggleButtonProps {
  $expanded: boolean;
  $hasOutput: boolean;
}

const ToggleButton = styled.button<ToggleButtonProps & { $blink?: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$hasOutput ? '#999' : '#555'};
  cursor: ${props => props.$hasOutput ? 'pointer' : 'default'};
  transform: ${props => props.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  outline: none;
  -webkit-app-region: no-drag;
  font-size: 14px;
  margin-right: 0;
  
  &:hover {
    color: ${props => props.$hasOutput ? 'var(--accent-color)' : '#555'};
  }
  
  ${props => props.$blink && !props.$expanded && `
    animation: blink-arrow 1.4s ease-in-out infinite;
  `}

  @keyframes blink-arrow {
    0% { opacity: 1; }
    45% { opacity: 0.2; }
    55% { opacity: 0.2; }
    100% { opacity: 1; }
  }
`;

interface OutputContainerProps {
  $expanded: boolean;
}

const OutputContainer = styled.div<OutputContainerProps>`
  overflow: hidden;
  max-height: ${props => props.$expanded ? "none" : "0"};
  opacity: ${props => props.$expanded ? "1" : "0"};
  transition: max-height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.2s ease-in-out;
  padding: ${props => props.$expanded ? "8px 16px" : "0 16px"};
  overflow-y: auto;
  background-color: var(--bg-color);
  -webkit-app-region: no-drag;
  user-select: text;
  pointer-events: auto;
  flex: ${props => props.$expanded ? "1" : "0"};
  min-height: 0; 
  display: flex;
  flex-direction: column;
`;

const OutputText = styled.pre`
  margin: 0;
  color: var(--text-color);
  font-size: var(--font-size-small);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.2em;
  
  .cursor {
    color: var(--accent-color);
    font-weight: bold;
    animation: blink 1s step-end infinite;
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
`;

const StdoutText = styled.span`
  color: var(--text-color);
`;

const StderrText = styled.span`
  color: var(--error-color);
`;

interface OutputLine {
  content: string;
  type: 'stdout' | 'stderr';
}

interface AutocompleteMatch {
  name: string;
  isDirectory: boolean;
}

const App: React.FC = () => {
  const [command, setCommand] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedCurrentCommand, setSavedCurrentCommand] = useState('');
  
  const [currentDirectory, setCurrentDirectory] = useState(os.homedir());
  
  const [autocompleteMatches, setAutocompleteMatches] = useState<AutocompleteMatch[]>([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  
  const [scale, setScale] = useState(1);
  
  const [settings, setSettings] = useState<Settings>({
    theme: Theme.DARK,
    showSettingsIcon: true
  });
  
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark');
  const actualTheme = settings.theme === Theme.SYSTEM 
    ? (systemTheme === 'light' ? Theme.LIGHT : Theme.DARK)
    : settings.theme;

  const [unreadOutput, setUnreadOutput] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('popterm-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = (_: any, newSettings: Settings) => {
      setSettings(newSettings);
    };
    
    const handleThemeChanged = (_: any, newTheme: string) => {
      setSettings(prev => ({ ...prev, theme: newTheme as Theme }));
      
      try {
        const savedSettings = localStorage.getItem('popterm-settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          parsedSettings.theme = newTheme;
          localStorage.setItem('popterm-settings', JSON.stringify(parsedSettings));
        }
      } catch (error) {
        console.error('Failed to update theme in localStorage:', error);
      }
    };
    
    const handleSystemThemeChanged = (_: any, newSystemTheme: 'light' | 'dark') => {
      setSystemTheme(newSystemTheme);
    };
    
    ipcRenderer.on('settings-updated', handleSettingsUpdated);
    ipcRenderer.on('theme-changed', handleThemeChanged);
    ipcRenderer.on('system-theme-changed', handleSystemThemeChanged);
    
    return () => {
      ipcRenderer.removeListener('settings-updated', handleSettingsUpdated);
      ipcRenderer.removeListener('theme-changed', handleThemeChanged);
      ipcRenderer.removeListener('system-theme-changed', handleSystemThemeChanged);
    };
  }, []);

  const hasOutput = outputLines.length > 0 || isExecuting;

  
  const getFormattedDirectory = () => {
    const homedir = os.homedir();
    if (currentDirectory.startsWith(homedir)) {
      return '~' + currentDirectory.substring(homedir.length);
    }
    return currentDirectory;
  };

  
  const getDirectoryName = () => {
    return path.basename(currentDirectory);
  };
  
  
  const toggleExpanded = () => {
    
    if (hasOutput) {
      setExpanded(!expanded);
    }
  };

  const clearOutput = () => {
    setOutputLines([]);
    setCommand('');
    if (expanded) {
      setExpanded(false);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  
  useEffect(() => {
    
    const shouldExpand = expanded && hasOutput;
    ipcRenderer.send('toggle-expand', shouldExpand);
  }, [expanded, hasOutput]);

  
  useEffect(() => {
    if (outputRef.current && expanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines, expanded]);

  
  useEffect(() => {
    const handleOutput = (_: any, data: { output: string, type: 'stdout' | 'stderr' }) => {
      setOutputLines(prev => [...prev, { content: data.output, type: data.type }]);
      if (!expanded) {
        setUnreadOutput(true);
      }
    };

    const handleComplete = () => {
      setIsExecuting(false);
    };

    const handleDirectoryChanged = (_: any, newDirectory: string) => {
      setCurrentDirectory(newDirectory);
    };
    
    
    const handleClearTerminal = () => {
      clearOutput();
    };
    
    const handleToggleOutput = () => {
      if (hasOutput) {
        toggleExpanded();
      }
    };
    
    
    const handleZoomIn = () => {
      setScale(prevScale => Math.min(prevScale + 0.1, 2.0));
    };
    
    const handleZoomOut = () => {
      setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
    };
    
    const handleZoomReset = () => {
      setScale(1.0);
    };

    ipcRenderer.on('command-output', handleOutput);
    ipcRenderer.on('command-complete', handleComplete);
    ipcRenderer.on('directory-changed', handleDirectoryChanged);
    ipcRenderer.on('clear-terminal', handleClearTerminal);
    ipcRenderer.on('toggle-output', handleToggleOutput);
    ipcRenderer.on('zoom-in', handleZoomIn);
    ipcRenderer.on('zoom-out', handleZoomOut);
    ipcRenderer.on('zoom-reset', handleZoomReset);

    return () => {
      ipcRenderer.removeListener('command-output', handleOutput);
      ipcRenderer.removeListener('command-complete', handleComplete);
      ipcRenderer.removeListener('directory-changed', handleDirectoryChanged);
      ipcRenderer.removeListener('clear-terminal', handleClearTerminal);
      ipcRenderer.removeListener('toggle-output', handleToggleOutput);
      ipcRenderer.removeListener('zoom-in', handleZoomIn);
      ipcRenderer.removeListener('zoom-out', handleZoomOut);
      ipcRenderer.removeListener('zoom-reset', handleZoomReset);
    };
  }, [expanded, hasOutput, clearOutput, toggleExpanded]); 

  
  const handleTabCompletion = () => {
    if (command.trim() === '') return;
    
    
    if (showAutocomplete && autocompleteMatches.length > 0) {
      applyAutocomplete(autocompleteMatches[selectedAutocompleteIndex]);
      return;
    }
    
    
    ipcRenderer.send('tab-complete', command);
  };
  
  
  const applyAutocomplete = (match: AutocompleteMatch) => {
    
    const parts = command.split(/\s+/);
    const lastPart = parts.pop() || '';
    
    
    const lastPartIndex = command.lastIndexOf(lastPart);
    
    
    let newCommand = command.substring(0, lastPartIndex);
    newCommand += match.name;
    
    
    if (match.isDirectory) {
      newCommand += '/';
    } else {
      
      newCommand += ' ';
    }
    
    setCommand(newCommand);
    setShowAutocomplete(false);
  };

  
  useEffect(() => {
    const handleTabCompleteResult = (_: any, data: { 
      matches: AutocompleteMatch[], 
      originalInput: string,
      lastWord: string
    }) => {
      if (data.matches.length === 0) {
        setShowAutocomplete(false);
        return;
      }
      
      if (data.matches.length === 1) {
        
        applyAutocomplete(data.matches[0]);
      } else {
        
        setAutocompleteMatches(data.matches);
        setSelectedAutocompleteIndex(0);
        setShowAutocomplete(true);
      }
    };
    
    ipcRenderer.on('tab-complete-result', handleTabCompleteResult);
    
    return () => {
      ipcRenderer.removeListener('tab-complete-result', handleTabCompleteResult);
    };
  }, [command]);
  
  
  useEffect(() => {
    const handleClickOutside = () => {
      setShowAutocomplete(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
      setShowAutocomplete(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    } else if (e.key === 'ArrowUp') {
      if (showAutocomplete) {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteMatches.length - 1
        );
      } else {
        e.preventDefault();
        
        if (commandHistory.length > 0) {
          if (historyIndex === -1) {
            
            setSavedCurrentCommand(command);
            
            setHistoryIndex(commandHistory.length - 1);
            setCommand(commandHistory[commandHistory.length - 1]);
          } else if (historyIndex > 0) {
            
            setHistoryIndex(historyIndex - 1);
            setCommand(commandHistory[historyIndex - 1]);
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (showAutocomplete) {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev < autocompleteMatches.length - 1 ? prev + 1 : 0
        );
      } else {
        e.preventDefault();
        
        if (historyIndex !== -1) {
          if (historyIndex === commandHistory.length - 1) {
            
            setHistoryIndex(-1);
            setCommand(savedCurrentCommand);
          } else {
            
            setHistoryIndex(historyIndex + 1);
            setCommand(commandHistory[historyIndex + 1]);
          }
        }
      }
    }
  };
  
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommand(e.target.value);
    setShowAutocomplete(false);
  };

  
  useEffect(() => {
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    
    const handleAppClick = (e: MouseEvent) => {
      
      if (
        showAutocomplete || 
        isExecuting ||
        (e.target as HTMLElement).tagName === 'BUTTON' ||
        (e.target as HTMLElement).closest('.autocomplete-item')
      ) {
        return;
      }
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    
    
    const handleKeyboardShortcuts = (e: globalThis.KeyboardEvent) => {
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setScale(prevScale => Math.min(prevScale + 0.1, 2.0));
        } else if (e.key === '-') {
          e.preventDefault();
          setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
        } else if (e.key === '0') {
          e.preventDefault();
          setScale(1.0);
        }
      }
    };
    
    document.addEventListener('click', handleAppClick);
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    return () => {
      document.removeEventListener('click', handleAppClick);
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [showAutocomplete, isExecuting]);

  const executeCommand = () => {
    if (!command.trim() || isExecuting) return;
    
    
    setOutputLines([{ content: `${getDirectoryName()} $ ${command}\n`, type: 'stdout' }]);
    setIsExecuting(true);
    
    
    setCommandHistory(prev => {
      
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }
      return [...prev, command];
    });
    
    setHistoryIndex(-1);
    
    
    const executedCommand = command;
    setCommand('');
    
    
    setTimeout(() => {
      ipcRenderer.send('execute-command', executedCommand);
      
      
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
    }, 0);
  };

  useEffect(() => {
    if (expanded) {
      setUnreadOutput(false);
    }
  }, [expanded]);

  return (
    <>
      <GlobalStyle $scale={scale} $theme={actualTheme} />
      <Container>
        <DragHandle $expanded={expanded && hasOutput} theme={actualTheme} />
        <ContentContainer>
          <InputContainer $expanded={expanded && hasOutput}>
            <Prompt>{getDirectoryName()} $</Prompt>
            <Input
              ref={inputRef}
              value={command}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter a command..."
              disabled={isExecuting}
              autoFocus
            />
            <ButtonGroup>
              <ToggleButton 
                $expanded={expanded} 
                $hasOutput={hasOutput}
                $blink={unreadOutput}
                onClick={toggleExpanded}
                title={hasOutput ? (expanded ? "Collapse" : "Expand") : "No output to show"}
              >
                ▼
              </ToggleButton>
              {(settings.showSettingsIcon !== false) && (
                <SettingsButton
                  onClick={() => ipcRenderer.send('open-settings')}
                  title="Settings"
                >
                  ⚙
                </SettingsButton>
              )}
            </ButtonGroup>
            
            {showAutocomplete && autocompleteMatches.length > 0 && (
              <AutocompleteContainer>
                {autocompleteMatches.map((match, index) => (
                  <AutocompleteItem 
                    key={index}
                    className="autocomplete-item"
                    $isSelected={index === selectedAutocompleteIndex}
                    onClick={() => applyAutocomplete(match)}
                  >
                    <div>
                      {match.isDirectory ? (
                        <span className="directory">{match.name}/</span>
                      ) : (
                        <span className="file">{match.name}</span>
                      )}
                    </div>
                    {index === selectedAutocompleteIndex && (
                      <span className="tab-icon">
                        press <span className="tab-key">Tab</span>
                      </span>
                    )}
                  </AutocompleteItem>
                ))}
              </AutocompleteContainer>
            )}
          </InputContainer>
          
          {hasOutput && (
            <OutputContainer 
              ref={outputRef} 
              $expanded={expanded}
              onClick={(e) => {
                if (window.getSelection()?.toString() === '') {
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }
              }}
            >
              <OutputText>
                {outputLines.map((line, index) => (
                  line.type === 'stdout' 
                    ? <StdoutText key={index}>{line.content}</StdoutText>
                    : <StderrText key={index}>{line.content}</StderrText>
                ))}
                {isExecuting && <span className="cursor">█</span>}
              </OutputText>
            </OutputContainer>
          )}
        </ContentContainer>
      </Container>
    </>
  );
};

export default App; 