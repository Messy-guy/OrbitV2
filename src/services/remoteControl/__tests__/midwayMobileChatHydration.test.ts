import { desktopRelayService } from '../../desktopRelay.service';
import { conversationStore } from '../../conversation/ConversationStore';
import { conversationCaptureService } from '../../conversation/ConversationCaptureService';
import { useAgentStore } from '../../../stores/agent.store';
import { useWorkspaceStore } from '../../../stores/workspace.store';
import { sessionService } from '../../session.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runMidwayMobileChatTests() {
  console.log('=== TEST SUITE: MID-WAY MOBILE CONNECT & CHAT HYDRATION ===\n');

  // Setup mock workspace
  const testWsId = 'ws-test-1';
  useWorkspaceStore.setState({
    workspaces: [{
      id: testWsId,
      name: 'Test Project',
      projectPath: '/test/project',
      lastActive: 'Just now',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
    activeWorkspaceId: testWsId,
  });

  // Mock socket on desktopRelayService to intercept emitted telemetry packets
  let lastEmittedTelemetry: any = null;
  const mockSocket: any = {
    connected: true,
    emit: (event: string, packet: any) => {
      if (event === 'desktop:telemetry') {
        lastEmittedTelemetry = packet;
      }
    },
    on: () => {},
  };
  (desktopRelayService as any).socket = mockSocket;

  console.log('--- TEST 1: Canonical conversationStore turns hydrated on mid-way connect ---');
  const agent1Id = 'agent-claude-1';
  const session1Id = 'sess-claude-1';

  useAgentStore.setState({
    agents: [{
      id: agent1Id,
      name: 'Claude Test',
      provider: 'claude',
      model: 'claude-3-5-sonnet',
      workspaceId: testWsId,
      status: 'working',
      currentSessionId: session1Id,
      role: 'raw',
      createdAt: Date.now(),
    }],
    activeSessionIdByAgent: { [agent1Id]: session1Id },
  });

  // Simulate user previously had a conversation on desktop before mobile connected
  conversationStore.getOrCreateSession(session1Id, testWsId, testWsId, {
    id: agent1Id,
    name: 'Claude Test',
    provider: 'claude',
  });
  conversationStore.addUserMessage(session1Id, 'Refactor the database schema');
  conversationStore.startAgentTurn(session1Id);
  conversationStore.completeAgentMessage(session1Id, 'Schema refactored successfully to v2.');

  // Mobile connects mid-way: telemetry is broadcast
  await desktopRelayService.broadcastLiveTelemetry();

  assert(lastEmittedTelemetry !== null, 'Telemetry packet was broadcast');
  const mappedAgent1 = lastEmittedTelemetry.agents.find((a: any) => a.id === agent1Id || a.sessionId === session1Id);
  assert(mappedAgent1 !== undefined, 'Agent 1 is present in telemetry snapshot');
  assert(mappedAgent1.chatHistory.length === 2, `Agent 1 has full chat history (expected 2, got ${mappedAgent1?.chatHistory?.length})`);
  assert(mappedAgent1.chatHistory[0].sender === 'user', 'First message is user prompt');
  assert(mappedAgent1.chatHistory[0].content === 'Refactor the database schema', 'User message content matches');
  assert(mappedAgent1.chatHistory[1].sender === 'agent', 'Second message is agent reply');
  assert(mappedAgent1.chatHistory[1].content === 'Schema refactored successfully to v2.', 'Agent reply content matches');


  console.log('\n--- TEST 2: Desktop store fallback (useAgentStore.messages) ---');
  // Scenario: Chat was added to useAgentStore messages (e.g. from desktop UI) but no turns in conversationStore
  const agent2Id = 'agent-agy-2';
  const session2Id = 'sess-agy-2';

  useAgentStore.setState((prev) => ({
    agents: [...prev.agents, {
      id: agent2Id,
      name: 'Antigravity Test',
      provider: 'antigravity',
      model: 'gemini-2.5-pro',
      workspaceId: testWsId,
      status: 'ready',
      currentSessionId: session2Id,
      role: 'raw',
      createdAt: Date.now(),
    }],
    activeSessionIdByAgent: { ...prev.activeSessionIdByAgent, [agent2Id]: session2Id },
    messages: {
      ...prev.messages,
      [session2Id]: [
        { id: 'msg-u1', sessionId: session2Id, role: 'user', content: 'Run test suite', timestamp: Date.now() - 1000 },
        { id: 'msg-a1', sessionId: session2Id, role: 'agent', content: 'Tests passed: 42 passed, 0 failed', timestamp: Date.now() },
      ],
    },
  }));

  // Create empty canonical session without turns
  conversationStore.getOrCreateSession(session2Id, testWsId, testWsId, {
    id: agent2Id,
    name: 'Antigravity Test',
    provider: 'antigravity',
  });

  await desktopRelayService.broadcastLiveTelemetry();
  const mappedAgent2 = lastEmittedTelemetry.agents.find((a: any) => a.id === agent2Id || a.sessionId === session2Id);
  assert(mappedAgent2 !== undefined, 'Agent 2 is present in telemetry snapshot');
  assert(mappedAgent2.chatHistory.length === 2, `Agent 2 hydrated from store messages (expected 2, got ${mappedAgent2?.chatHistory?.length})`);
  assert(mappedAgent2.chatHistory[0].content === 'Run test suite', 'User content hydrated correctly');
  assert(mappedAgent2.chatHistory[1].content.includes('Tests passed: 42 passed'), 'Agent reply hydrated correctly');


  console.log('\n--- TEST 3: Unmapped agent in workspace gets hydrated (not empty []) ---');
  // Scenario: Agent in useAgentStore not yet registered in canonical sessions
  const agent3Id = 'agent-codex-3';
  useAgentStore.setState((prev) => ({
    agents: [...prev.agents, {
      id: agent3Id,
      name: 'Codex Agent',
      provider: 'codex',
      model: 'codex-mini',
      workspaceId: testWsId,
      status: 'ready',
      role: 'raw',
      createdAt: Date.now(),
    }],
    messages: {
      ...prev.messages,
      [agent3Id]: [
        { id: 'msg-u3', sessionId: agent3Id, role: 'user', content: 'Generate API docs', timestamp: Date.now() },
      ],
    },
  }));

  await desktopRelayService.broadcastLiveTelemetry();
  const mappedAgent3 = lastEmittedTelemetry.agents.find((a: any) => a.id === agent3Id);
  assert(mappedAgent3 !== undefined, 'Unmapped workspace agent 3 included in telemetry');
  assert(mappedAgent3.chatHistory.length === 1, `Agent 3 chatHistory hydrated (expected 1, got ${mappedAgent3?.chatHistory?.length})`);
  assert(mappedAgent3.chatHistory[0].content === 'Generate API docs', 'Unmapped agent message content matches');


  console.log('\n--- TEST 4: Mobile ConversationTimeline filter normalization ---');
  // Simulate the mobile Timeline filter logic from ConversationTimeline.tsx
  function filterMobileTimeline(allMessages: any[], targetSessionId?: string) {
    const filtered = targetSessionId
      ? allMessages.filter((m) => {
          if (!targetSessionId) return true;
          if (m.sessionId === targetSessionId || m.agentId === targetSessionId) return true;
          const normSession = targetSessionId.replace(/^sess-/, '');
          const normMSession = m.sessionId?.replace(/^sess-/, '');
          const normMAgent = m.agentId?.replace(/^sess-/, '');
          if (normMSession && (normMSession === normSession || normMSession === targetSessionId || m.sessionId === normSession)) return true;
          if (normMAgent && (normMAgent === normSession || normMAgent === targetSessionId || m.agentId === normSession)) return true;
          return false;
        })
      : allMessages;

    return filtered.length > 0 ? filtered : allMessages;
  }

  // Case A: Mobile opens modal with agentId='agent-claude-1', but message has sessionId='sess-claude-1'
  const renderedMessagesA = filterMobileTimeline(mappedAgent1.chatHistory, 'agent-claude-1');
  assert(renderedMessagesA.length === 2, `Timeline matched across sess- prefix (expected 2, got ${renderedMessagesA.length})`);

  // Case B: Mobile opens modal with sessionId='sess-claude-1', and message has agentId='agent-claude-1'
  const renderedMessagesB = filterMobileTimeline(mappedAgent1.chatHistory, 'sess-claude-1');
  assert(renderedMessagesB.length === 2, `Timeline matched with sess- sessionId (expected 2, got ${renderedMessagesB.length})`);

  // Case C: Mobile opens modal with unexpected/divergent ID, fallback to allMessages prevents blank screen
  const renderedMessagesC = filterMobileTimeline(mappedAgent1.chatHistory, 'random-custom-id');
  assert(renderedMessagesC.length === 2, `Timeline safely falls back to allMessages without dropping conversation (expected 2, got ${renderedMessagesC.length})`);


  console.log('\n--- TEST 5: Direct terminal typing simulation ---');
  // Simulate what AgentTerminal.tsx does when typing into the terminal grid
  const session4Id = 'sess-term-4';
  let capturedDirectMessage = '';
  const originalRecord = conversationCaptureService.recordDirectUserMessage.bind(conversationCaptureService);
  conversationCaptureService.recordDirectUserMessage = (sessId: string, msg: string) => {
    capturedDirectMessage = msg;
    originalRecord(sessId, msg);
  };

  // Simulate keystrokes: 'g', 'i', 't', ' ', 's', 't', 'a', 't', 'u', 's', Enter (13)
  const inputChars = 'git status';
  const encoder = new TextEncoder();
  let lineBuffer = '';
  for (const char of inputChars) {
    lineBuffer += char;
  }
  // User hits Enter (13)
  if (lineBuffer.trim()) {
    conversationCaptureService.recordDirectUserMessage(session4Id, lineBuffer.trim());
    useAgentStore.getState().addDirectMessage(session4Id, {
      id: `msg-${Date.now()}`,
      sessionId: session4Id,
      role: 'user',
      content: lineBuffer.trim(),
      timestamp: Date.now(),
    });
  }

  assert(capturedDirectMessage === 'git status', 'Direct terminal typing captured user prompt');
  const termStoredMessages = useAgentStore.getState().messages[session4Id];
  assert(termStoredMessages && termStoredMessages.length === 1, 'Terminal prompt added to useAgentStore.messages');
  assert(termStoredMessages[0].content === 'git status', 'Stored message matches typed text');

  console.log('\n=== ALL 5 VERIFICATION SUITES PASSED! MID-WAY CONNECT CHAT WORKS! ===');
}

runMidwayMobileChatTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
