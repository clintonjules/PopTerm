import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import styled from 'styled-components';
import { ipcRenderer } from 'electron';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Menlo', 'Monaco', monospace;
  -webkit-app-region: drag;
`;

interface InputContainerProps {
  $expanded: boolean;
}

const InputContainer = styled.div<InputContainerProps>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: ${props => props.$expanded ? '1px solid #444' : 'none'};
`;

const Prompt = styled.span`
  color: #6adf91;
  margin-right: 8px;
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
  max-height: 500px;
  overflow-y: auto;
  padding: 8px 16px;
  background-color: rgba(30, 30, 30, 0.95);
  -webkit-app-region: no-drag;
`;

const OutputText = styled.pre`
  margin: 0;
  color: #ddd;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
`;

const StdoutText = styled.span`
  color: #ddd;
`;

const StderrText = styled.span`
  color: #ff6b6b;
`;

interface OutputLine {
  content: string;
  type: 'stdout' | 'stderr';
}

const App: React.FC = () => {
  const [command, setCommand] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate if we have any output to show
  const hasOutput = outputLines.length > 0 || isExecuting;

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

    ipcRenderer.on('command-output', handleOutput);
    ipcRenderer.on('command-complete', handleComplete);

    return () => {
      ipcRenderer.removeListener('command-output', handleOutput);
      ipcRenderer.removeListener('command-complete', handleComplete);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommand(e.target.value);
  };

  const executeCommand = () => {
    if (!command.trim() || isExecuting) return;
    
    setIsExecuting(true);
    // Don't automatically expand when executing command
    // setExpanded(true);
    
    // Add command to output
    setOutputLines(prev => [
      ...prev, 
      { content: `$ ${command}\n`, type: 'stdout' }
    ]);
    
    ipcRenderer.send('execute-command', command);
    setCommand('');
    
    // Focus the input again
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
    }
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
    <Container>
      <InputContainer $expanded={expanded && hasOutput}>
        <Prompt>$</Prompt>
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
      </InputContainer>
      
      {hasOutput && (
        <OutputContainer ref={outputRef} $expanded={expanded}>
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
    </Container>
  );
};

export default App; 