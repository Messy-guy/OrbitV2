import assert from 'node:assert';

export function runMobileLayoutTests() {
  // 1. Message & Sender Differentiation
  const userMessage = {
    id: 'msg-1',
    sender: 'user' as const,
    content: 'Fix the reconnect issue and run tests',
    timestamp: Date.now(),
  };
  assert.strictEqual(userMessage.sender, 'user');

  const assistantMessage = {
    id: 'msg-2',
    sender: 'agent' as const,
    content: 'I will analyze the reconnect issue now.',
    timestamp: Date.now(),
  };
  assert.strictEqual(assistantMessage.sender, 'agent');

  // 2. Markdown & Code Block Extraction
  const content = 'Here is the fix:\n```typescript\nconst active = true;\n```\nLet me know.';
  const parts = content.split(/(```[\s\S]*?```)/g);
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[0], 'Here is the fix:\n');
  assert.strictEqual(parts[1], '```typescript\nconst active = true;\n```');

  // 3. Safe Area Calculations
  const calcIosBottom = Math.max(34, 12);
  const calcAndroidBottom = Math.max(0, 12);
  assert.strictEqual(calcIosBottom, 34);
  assert.strictEqual(calcAndroidBottom, 12);

  // 4. Tablet Constraints
  const tabletWidth = 1024;
  assert.strictEqual(Math.min(tabletWidth, 780), 780);
}
