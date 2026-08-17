import React, { useState, useRef, useEffect } from 'react';
import { CornerDownLeft, Sparkles, FileCode, CheckCircle2, ArrowRight, Copy, Check, Terminal } from 'lucide-react';
import { Agent, Message } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { ToolActivity } from './ToolActivity';
import { clsx } from 'clsx';

interface AgentChatProps {
  agent: Agent;
  sessionId: string;
}

export const AgentChat: React.FC<AgentChatProps> = ({ agent, sessionId }) => {
  const { messages, sendMessage } = useAgentStore();
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    sendMessage(agent.id, sessionId, text.trim());
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
    <div className="flex-1 flex flex-col min-h-0 bg-panel">
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 select-text font-sans">
        {sessionMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-text-muted text-xs">
            <span className="font-mono mb-1 text-text-secondary text-[11px]">Session initialized</span>
            <span className="text-[11px] mb-3">Direct developer prompt interface to {agent.name}.</span>
            
            {/* Quick Prompts */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xs">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp)}
                  className="px-2 py-1 rounded bg-panel-elevated hover:bg-panel-hover border border-border text-[10.5px] font-mono text-text-secondary hover:text-text-primary transition-colors text-left"
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
                className="p-3 rounded bg-background border border-accent/40 text-xs font-mono space-y-2 my-2 shadow-subtle"
              >
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 text-accent font-bold tracking-wider uppercase text-[10px]">
                    <Sparkles size={11} />
                    <span>ORBIT CONTEXT HANDOFF</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {h.tokenCount ? `~${(h.tokenCount / 1000).toFixed(1)}k tokens` : ''}
                  </span>
                </div>

                <div className="text-text-primary text-[12px] font-sans">
                  Resumed state from <strong className="text-accent font-semibold">{h.fromAgent}</strong>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div>
                    <span className="text-text-muted uppercase text-[9px] block font-bold">Objective</span>
                    <span className="text-text-primary font-medium">{h.task}</span>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase text-[9px] block font-bold">Progress</span>
                    <span className="text-text-secondary">{h.progress}</span>
                  </div>
                  <div>
                    <span className="text-text-muted uppercase text-[9px] block font-bold">Current Issue</span>
                    <span className="text-status-warning font-medium">{h.issues}</span>
                  </div>
                  {h.files && h.files.length > 0 && (
                    <div>
                      <span className="text-text-muted uppercase text-[9px] block font-bold">Relevant Files</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {h.files.map((f, i) => (
                          <span key={i} className="px-1.5 py-0.2 rounded bg-panel-elevated border border-border text-text-primary text-[10px]">
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
                <div className="flex items-center gap-1 mb-0.5 mr-1">
                  <span className="text-[9px] font-mono text-text-dim uppercase font-bold">You</span>
                </div>
                <div className="max-w-[92%] bg-panel-elevated border border-border rounded-lg px-3 py-1.5 text-[12.5px] text-text-primary leading-relaxed shadow-subtle">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex flex-col items-start group">
              <div className="flex items-center justify-between w-full mb-0.5 px-1">
                <span className="text-[9px] font-mono text-text-dim uppercase font-bold">{agent.name}</span>
                <button
                  onClick={() => copyToClipboard(msg.id, msg.content)}
                  className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-text-secondary transition-opacity p-0.5"
                  title="Copy message"
                >
                  {copiedId === msg.id ? <Check size={10} className="text-status-success" /> : <Copy size={10} />}
                </button>
              </div>
              <div className="max-w-[96%] bg-background-secondary border border-border-subtle rounded-lg px-3 py-2 text-[12.5px] text-text-primary leading-relaxed">
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
            <span className="text-[9px] font-mono text-text-dim mb-0.5 ml-1 uppercase font-bold">{agent.name}</span>
            <div className="bg-background-secondary border border-border-subtle rounded-lg px-3 py-1.5">
              <ToolActivity isWorking={true} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-2 bg-panel-elevated/40 border-t border-border no-drag">
        <div className="relative flex items-center bg-background border border-border rounded-btn focus-within:border-border-active focus-within:ring-1 focus-within:ring-accent/30 transition-all">
          <span className="pl-2.5 text-text-muted font-mono text-xs select-none font-bold">&gt;</span>
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
            className="flex-1 bg-transparent py-1.5 px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[30px] max-h-[100px] font-sans"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || agent.status === 'working'}
            className="p-1 mr-1 text-text-muted hover:text-accent disabled:opacity-20 disabled:hover:text-text-muted transition-colors rounded"
            title="Send prompt"
          >
            <CornerDownLeft size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
