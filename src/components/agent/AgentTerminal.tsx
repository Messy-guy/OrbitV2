import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft, Play, XCircle, RotateCcw, Copy, Check } from 'lucide-react';
import { Agent, TerminalLine } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';

interface AgentTerminalProps {
  agent: Agent;
}

export const AgentTerminal: React.FC<AgentTerminalProps> = ({ agent }) => {
  const { terminalLogs, sendTerminalCommand, clearTerminal, interruptAgent } = useAgentStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeWorkspace = getActiveWorkspace();
  const logs = terminalLogs[agent.id] || [];

  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleSend = (cmdToSend?: string) => {
    const cmd = cmdToSend || input;
    if (!cmd.trim()) return;

    sendTerminalCommand(agent.id, cmd.trim());
    setHistory(prev => [cmd.trim(), ...prev]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      interruptAgent(agent.id);
      setInput('');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearTerminal(agent.id);
    }
  };

  const copyBuffer = () => {
    const text = logs.map(l => l.text.replace(/\x1b\[[0-9;]*m/g, '')).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Helper to render ANSI-like tokens in raw terminal text
  const formatTerminalText = (line: TerminalLine) => {
    const cleanText = line.text;

    if (line.type === 'stdin') {
      return (
        <span className="text-white font-bold">
          <span className="text-status-success">$ </span>
          {cleanText.replace(/^\$\s*/, '')}
        </span>
      );
    }

    if (line.type === 'tool') {
      return (
        <span className="text-cyan-400">
          {cleanText.replace(/\x1b\[[0-9;]*m/g, '')}
        </span>
      );
    }

    if (line.type === 'diff-add') {
      return <span className="text-status-success font-mono">{cleanText}</span>;
    }

    if (line.type === 'diff-del') {
      return <span className="text-status-error font-mono">{cleanText}</span>;
    }

    if (line.type === 'system') {
      return (
        <span className="text-text-muted">
          {cleanText.replace(/\x1b\[[0-9;]*m/g, '')}
        </span>
      );
    }

    if (line.type === 'stderr') {
      return <span className="text-status-error">{cleanText}</span>;
    }

    // Default stdout
    return (
      <span className="text-text-secondary whitespace-pre-wrap">
        {cleanText.replace(/\x1b\[[0-9;]*m/g, '')}
      </span>
    );
  };

  const quickCommands = [
    { label: 'diff', cmd: 'git diff' },
    { label: 'test', cmd: 'npm test' },
    { label: 'status', cmd: 'git status' },
    { label: 'clear', cmd: 'clear' },
  ];

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-[#0E0F13] font-mono text-[11px] select-text cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Mini Toolbar */}
      <div className="h-6 px-2.5 bg-[#14151A] border-b border-border-subtle flex items-center justify-between text-[10px] text-text-dim select-none no-drag">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-text-muted">
            <TerminalIcon size={10} className="text-text-dim" />
            <span>PID {agent.pid || 4812}</span>
          </span>
          <span>·</span>
          <span className="text-text-dim truncate max-w-[140px]">
            {activeWorkspace?.name || 'workspace'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick command buttons */}
          <div className="hidden sm:flex items-center gap-1 mr-1">
            {quickCommands.map((qc) => (
              <button
                key={qc.label}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSend(qc.cmd);
                }}
                className="px-1.5 py-0.2 rounded bg-well hover:bg-panel hover:text-text-primary text-text-muted text-[9.5px] transition-colors border border-border-subtle"
              >
                {qc.label}
              </button>
            ))}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              copyBuffer();
            }}
            className="p-0.5 text-text-dim hover:text-text-primary rounded hover:bg-panel"
            title="Copy Terminal Buffer"
          >
            {copied ? <Check size={10} className="text-status-success" /> : <Copy size={10} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              interruptAgent(agent.id);
            }}
            className="p-0.5 text-text-dim hover:text-status-error rounded hover:bg-panel"
            title="Interrupt (Ctrl+C)"
          >
            <XCircle size={10} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              clearTerminal(agent.id);
            }}
            className="p-0.5 text-text-dim hover:text-text-primary rounded hover:bg-panel"
            title="Clear Terminal (Ctrl+L)"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport (Scrollable Buffer) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11.5px] leading-relaxed">
        {logs.map((line) => (
          <div key={line.id} className="leading-tight">
            {formatTerminalText(line)}
          </div>
        ))}

        {agent.status === 'working' && (
          <div className="flex items-center gap-2 text-text-muted animate-pulse pt-1 text-[11px]">
            <span className="w-1.5 h-3 bg-text-primary inline-block animate-ping" />
            <span className="text-text-dim">Process executing...</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Prompt Input Line */}
      <div className="px-3 py-2 bg-[#121318] border-t border-border-subtle flex items-center gap-2 no-drag">
        <span className="text-status-success font-bold shrink-0 select-none">
          {agent.provider === 'claude' ? 'claude>' : agent.provider === 'codex' ? 'codex$' : `${agent.name.toLowerCase()}>`}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command or prompt... (Enter to run, Ctrl+C to stop)"
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-dim text-[11.5px] focus:outline-none font-mono"
          autoFocus
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || agent.status === 'working'}
          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-20 transition-colors"
          title="Run command"
        >
          <CornerDownLeft size={12} />
        </button>
      </div>
    </div>
  );
};
