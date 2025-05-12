import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as os from 'os';

// Add global CSS variables
const GlobalStyle = createGlobalStyle`
  :root {
    --bg-color: rgba(30, 30, 30, 0.8);
    --bg-color-translucent: rgba(30, 30, 30, 0.5);
    --border-color: #444;
    --text-color: #ddd;
    --accent-color: #6adf91;
    --error-color: #ff6b6b;
  }
`;

// Add a drag handle component
const DragHandle = styled.div`
  width: 15px;
  height: 100%;
  background-color: rgba(50, 50, 50, 0.8);
  cursor: grab;
  -webkit-app-region: drag;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(70, 70, 70, 0.8);
  }
  
  &::after {
    content: "";
    width: 2px;
    height: 20px;
    background-color: #666;
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

// Add a content container for the main app content
const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  background-color: var(--bg-color);
`;

interface InputContainerProps {
  $expanded: boolean;
}

// Add a styled component for autocompletion suggestions
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
  background-color: ${props => props.$isSelected ? 'rgba(70, 70, 70, 0.8)' : 'transparent'};
  
  &:hover {
    background-color: rgba(60, 60, 60, 0.8);
  }
  
  .directory {
    color: var(--accent-color);
  }
  
  .file {
    color: var(--text-color);
  }
`;

// Update InputContainer to handle positioning the autocomplete dropdown
const InputContainer = styled.div<InputContainerProps>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-color);
  border-bottom: 1px solid ${props => props.$expanded ? 'var(--border-color)' : 'transparent'};
  -webkit-app-region: no-drag;
  height: 45px;
  box-sizing: border-box;
  position: relative;
`;

const Prompt = styled.span`
  color: var(--accent-color);
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
`;

const Input = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  -webkit-app-region: no-drag;
  height: 100%;
  line-height: normal;
  vertical-align: middle;
  padding: 0;
`;

interface ToggleButtonProps {
  $expanded: boolean;
  $hasOutput: boolean;
}

const ToggleButton = styled.button<ToggleButtonProps>`
  background: transparent;
  border: none;
  color: ${props => props.$hasOutput ? '#999' : '#555'};
  cursor: ${props => props.$hasOutput ? 'pointer' : 'default'};
  transform: ${props => props.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform 0.2s ease;
  outline: none;
  -webkit-app-region: no-drag;
  
  &:hover {
    color: ${props => props.$hasOutput ? '#fff' : '#555'};
  }
`;

interface OutputContainerProps {
  $expanded: boolean;
}

const OutputContainer = styled.div<OutputContainerProps>`
  display: ${props => props.$expanded ? 'block' : 'none'};
  max-height: calc(10 * 1.2em);
  overflow-y: auto;
  padding: 8px 16px;
  background-color: var(--bg-color);
  -webkit-app-region: no-drag;
  user-select: text;
  pointer-events: auto;
`;

const OutputText = styled.pre`
  margin: 0;
  color: var(--text-color);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.2em;
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
  // Add command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedCurrentCommand, setSavedCurrentCommand] = useState('');
  // Add current directory state
  const [currentDirectory, setCurrentDirectory] = useState(os.homedir());
  // Add autocomplete state
  const [autocompleteMatches, setAutocompleteMatches] = useState<AutocompleteMatch[]>([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate if we have any output to show
  const hasOutput = outputLines.length > 0 || isExecuting;

  // Format the current directory for display
  const getFormattedDirectory = () => {
    const homedir = os.homedir();
    if (currentDirectory.startsWith(homedir)) {
      return '~' + currentDirectory.substring(homedir.length);
    }
    return currentDirectory;
  };

  // Get the directory name for display
  const getDirectoryName = () => {
    return path.basename(currentDirectory);
  };

  // Notify main process of expansion state changes
  useEffect(() => {
    // Only notify main process to expand if we actually have output
    const shouldExpand = expanded && hasOutput;
    ipcRenderer.send('toggle-expand', shouldExpand);
  }, [expanded, hasOutput]);

  // Auto scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current && expanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines, expanded]);

  // Setup IPC listeners
  useEffect(() => {
    const handleOutput = (_: any, data: { output: string, type: 'stdout' | 'stderr' }) => {
      setOutputLines(prev => [...prev, { content: data.output, type: data.type }]);
    };

    const handleComplete = () => {
      setIsExecuting(false);
    };

    const handleDirectoryChanged = (_: any, newDirectory: string) => {
      setCurrentDirectory(newDirectory);
    };

    ipcRenderer.on('command-output', handleOutput);
    ipcRenderer.on('command-complete', handleComplete);
    ipcRenderer.on('directory-changed', handleDirectoryChanged);

    return () => {
      ipcRenderer.removeListener('command-output', handleOutput);
      ipcRenderer.removeListener('command-complete', handleComplete);
      ipcRenderer.removeListener('directory-changed', handleDirectoryChanged);
    };
  }, []);

  // Handle Tab key for autocompletion
  const handleTabCompletion = () => {
    if (command.trim() === '') return;
    
    // If autocomplete is already showing and we have matches
    if (showAutocomplete && autocompleteMatches.length > 0) {
      applyAutocomplete(autocompleteMatches[selectedAutocompleteIndex]);
      return;
    }
    
    // Request tab completion from main process
    ipcRenderer.send('tab-complete', command);
  };
  
  // Apply the selected autocomplete suggestion
  const applyAutocomplete = (match: AutocompleteMatch) => {
    // Get the parts of the command
    const parts = command.split(/\s+/);
    const lastPart = parts.pop() || '';
    
    // Find where the last part starts in the command
    const lastPartIndex = command.lastIndexOf(lastPart);
    
    // Create the new command with the autocomplete applied
    let newCommand = command.substring(0, lastPartIndex);
    newCommand += match.name;
    
    // Add trailing slash for directories
    if (match.isDirectory) {
      newCommand += '/';
    } else {
      // Add space for completed commands/files
      newCommand += ' ';
    }
    
    setCommand(newCommand);
    setShowAutocomplete(false);
  };

  // Setup IPC listeners for tab completion
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
        // If there's only one match, apply it directly
        applyAutocomplete(data.matches[0]);
      } else {
        // Show autocomplete suggestions
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
  
  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowAutocomplete(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Update handleKeyDown for Tab, Escape, and arrow keys for autocomplete
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
        // Navigate up through history
        if (commandHistory.length > 0) {
          if (historyIndex === -1) {
            // Save current command when starting to navigate history
            setSavedCurrentCommand(command);
            // Start from the most recent command
            setHistoryIndex(commandHistory.length - 1);
            setCommand(commandHistory[commandHistory.length - 1]);
          } else if (historyIndex > 0) {
            // Move up in history
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
        // Navigate down through history
        if (historyIndex !== -1) {
          if (historyIndex === commandHistory.length - 1) {
            // At the end of history, restore the saved command
            setHistoryIndex(-1);
            setCommand(savedCurrentCommand);
          } else {
            // Move down in history
            setHistoryIndex(historyIndex + 1);
            setCommand(commandHistory[historyIndex + 1]);
          }
        }
      }
    }
  };
  
  // Close autocomplete when input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommand(e.target.value);
    setShowAutocomplete(false);
  };

  // Auto-focus input on mount and after command execution
  useEffect(() => {
    // Focus the input when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Setup a click handler to focus input when clicking anywhere in the app
    const handleAppClick = (e: MouseEvent) => {
      // Don't refocus if clicking on autocomplete or if currently executing
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
    
    document.addEventListener('click', handleAppClick);
    
    return () => {
      document.removeEventListener('click', handleAppClick);
    };
  }, [showAutocomplete, isExecuting]);

  const executeCommand = () => {
    if (!command.trim() || isExecuting) return;
    
    // Clear output first, then set executing state
    setOutputLines([{ content: `${getDirectoryName()} $ ${command}\n`, type: 'stdout' }]);
    setIsExecuting(true);
    
    // Add command to history
    setCommandHistory(prev => {
      // Don't add duplicate commands in a row
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }
      return [...prev, command];
    });
    // Reset history index
    setHistoryIndex(-1);
    
    // Store the command before clearing the input
    const executedCommand = command;
    setCommand('');
    
    // Execute after state updates
    setTimeout(() => {
      ipcRenderer.send('execute-command', executedCommand);
      
      // Focus the input again - use a slightly longer timeout to ensure focus works
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
    }, 0);
  };

  const toggleExpanded = () => {
    // Only toggle if we have output to show
    if (hasOutput) {
      setExpanded(!expanded);
    }
  };

  const clearOutput = () => {
    setOutputLines([]);
    // If expanded, collapse the window when clearing output
    if (expanded) {
      setExpanded(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <Container>
        <DragHandle />
        <ContentContainer>
          <InputContainer $expanded={expanded && hasOutput}>
            <Prompt>{getDirectoryName()} $</Prompt>
            <Input
              ref={inputRef}
              value={command}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              disabled={isExecuting}
              autoFocus
            />
            <ToggleButton 
              $expanded={expanded} 
              $hasOutput={hasOutput}
              onClick={toggleExpanded}
              title={hasOutput ? (expanded ? "Collapse" : "Expand") : "No output to show"}
            >
              ▼
            </ToggleButton>
            
            {showAutocomplete && autocompleteMatches.length > 0 && (
              <AutocompleteContainer>
                {autocompleteMatches.map((match, index) => (
                  <AutocompleteItem 
                    key={index}
                    className="autocomplete-item"
                    $isSelected={index === selectedAutocompleteIndex}
                    onClick={() => applyAutocomplete(match)}
                  >
                    {match.isDirectory ? (
                      <span className="directory">{match.name}/</span>
                    ) : (
                      <span className="file">{match.name}</span>
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
                // Only refocus if no text is being selected
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
                {isExecuting && <span className="cursor">_</span>}
              </OutputText>
            </OutputContainer>
          )}
        </ContentContainer>
      </Container>
    </>
  );
};

export default App; 