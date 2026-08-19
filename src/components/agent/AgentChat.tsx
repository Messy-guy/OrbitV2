import React, { useState, useRef, useEffect } from 'react';
import { CornerDownLeft, ArrowLeftRight, Copy, Check } from 'lucide-react';
import { Agent } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { ToolActivity } from './ToolActivity';

interface AgentChatProps {
  agent: Agent;
  sessionId: string;
}

export const AgentChat: React.FC<AgentChatProps> = ({ agent, sessionId }) => {
  const { messages, sendMessage } = useAgentStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeWorkspace = getActiveWorkspace();
  const sessionMessages = messages[sessionId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionMessages]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;
    sendMessage(agent.id, sessionId, text.trim(), activeWorkspace?.projectPath);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const quickPrompts = [
    'Fix the reconnect issue',
    'Run socket integration tests',
    'Inspect uncommitted git diff',
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 surface-well">
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text font-sans">
        {sessionMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-text-muted text-xs">
            <span className="font-mono mb-1 text-text-secondary text-[11px] font-semibold uppercase tracking-wider">Session Initialized</span>
            <span className="text-[11px] text-text-dim mb-4 max-w-xs">Direct developer prompt interface connected to {agent.name}.</span>
            
            {/* Quick Prompts */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xs">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp)}
                  className="px-2.5 py-1 rounded-btn btn-base text-[10.5px] font-mono text-text-secondary hover:text-text-primary transition-colors text-left"
                >
                  &gt; {qp}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {sessionMessages.map((msg) => {
          // Special Render for ORBIT HANDOFF message
          if (msg.isHandoffMessage && msg.handoffData) {
            const h = msg.handoffData;
            return (
              <div
                key={msg.id}
                className="p-3.5 rounded-panel surface-elevated text-xs font-mono space-y-2.5 my-2 shadow-elevated border-border-hover"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5 text-text-primary font-bold tracking-wider uppercase text-[10.5px]">
                    <ArrowLeftRight size={12} className="text-text-primary" />
                    <span>ORBIT CONTEXT HANDOFF</span>
                  </div>
                  <span className="text-[10px] text-text-muted px-1.5 py-0.2 rounded-badge bg-well border border-border-subtle font-mono">
                    {h.tokenCount ? `~${(h.tokenCount / 1000).toFixed(1)}k tokens` : ''}
                  </span>
                </div>

                <div className="text-text-primary text-[12px] font-sans">
                  Resumed state from <strong className="text-text-primary font-bold font-mono">{h.fromAgent}</strong>
                </div>

                <div className="space-y-1.5 text-[11.5px]">
                  <div className="p-2.5 rounded-btn surface-well">
                    <span className="text-text-dim uppercase text-[9px] block font-mono font-bold">Objective</span>
                    <span className="text-text-primary font-medium">{h.task}</span>
                  </div>
                  <div className="p-2.5 rounded-btn surface-well">
                    <span className="text-text-dim uppercase text-[9px] block font-mono font-bold">Progress</span>
                    <span className="text-text-secondary">{h.progress}</span>
                  </div>
                  <div className="p-2.5 rounded-btn surface-well">
                    <span className="text-text-dim uppercase text-[9px] block font-mono font-bold">Current Issue</span>
                    <span className="text-status-warning font-medium">{h.issues}</span>
                  </div>
                  {h.files && h.files.length > 0 && (
                    <div className="p-2.5 rounded-btn surface-well">
                      <span className="text-text-dim uppercase text-[9px] block font-mono font-bold mb-1">Relevant Files</span>
                      <div className="flex flex-wrap gap-1">
                        {h.files.map((f, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-badge btn-base text-text-primary text-[10px] font-mono">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex flex-col items-end group">
                <div className="flex items-center gap-1 mb-1 mr-1">
                  <span className="text-[9px] font-mono text-text-dim uppercase font-bold tracking-wider">You</span>
                </div>
                <div className="max-w-[88%] bg-panel-elevated border border-border-hover rounded-panel px-3.5 py-2 text-[12px] text-text-primary leading-relaxed shadow-subtle">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex flex-col items-start group">
              <div className="flex items-center justify-between w-full mb-1 px-1">
                <span className="text-[9.5px] font-mono text-text-muted uppercase font-bold tracking-wider">{agent.name}</span>
                <button
                  onClick={() => copyToClipboard(msg.id, msg.content)}
                  className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-text-primary transition-colors p-1 rounded hover:bg-panel"
                  title="Copy message"
                >
                  {copiedId === msg.id ? <Check size={10} className="text-status-success" /> : <Copy size={10} />}
                </button>
              </div>
              <div className="max-w-[96%] bg-panel/75 rounded-panel px-3.5 py-2.5 text-[12px] text-text-primary leading-relaxed border border-border">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                  <ToolActivity toolInvocations={msg.toolInvocations} />
                )}
              </div>
            </div>
          );
        })}

        {agent.status === 'working' && (
          <div className="flex flex-col items-start">
            <span className="text-[9.5px] font-mono text-text-dim mb-1 ml-1 uppercase font-bold">{agent.name}</span>
            <div className="bg-panel rounded-panel px-3.5 py-2 border border-border">
              <ToolActivity isWorking={true} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-2.5 bg-panel border-t border-border no-drag">
        <div className="relative flex items-center surface-well rounded-btn focus-within:border-border-highlight transition-colors shadow-well">
          <span className="pl-3 text-text-dim font-mono text-xs select-none font-bold">&gt;</span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agent.name}... (Press Enter to send)`}
            rows={1}
            className="flex-1 bg-transparent py-2 px-2.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none resize-none min-h-[32px] max-h-[100px] font-sans"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || agent.status === 'working'}
            className="p-1.5 mr-1 text-text-muted hover:text-text-primary disabled:opacity-20 disabled:hover:text-text-muted transition-colors rounded hover:bg-panel"
            title="Send prompt"
          >
            <CornerDownLeft size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
