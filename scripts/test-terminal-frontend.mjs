#!/usr/bin/env node

// The repository does not depend on a browser test runner. Compile the pure
// terminal modules with the project's TypeScript compiler and exercise their
// public behavior in Node instead. React is only imported by the store module;
// no hook is invoked by this test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-terminal-frontend-'));

function compile(relativePath, replacements = []) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  const outputPath = path.join(tempRoot, path.basename(relativePath, '.ts') + '.mjs');
  fs.writeFileSync(outputPath, output);
  return outputPath;
}

const protocolPath = compile('src/services/terminal/terminalProtocol.ts');
const inputPath = compile('src/services/terminal/terminalInput.ts');
const selectionPath = compile('src/components/terminal/TerminalSelection.ts');
const storePath = compile('src/services/terminal/terminalSessionStore.ts', [
  ["'./terminalProtocol'", "'./terminalProtocol.mjs'"],
  ["import { useSyncExternalStore } from 'react';", "const useSyncExternalStore = () => { throw new Error('hook not used in protocol test'); };"],
]);

const protocol = await import(pathToFileURL(protocolPath));
const input = await import(pathToFileURL(inputPath));
const selection = await import(pathToFileURL(selectionPath));
const { TerminalSessionStore } = await import(pathToFileURL(storePath));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function color(r, g, b) { return { r, g, b, a: 255 }; }
function cell(text, width = 1) {
  return {
    text,
    foreground: color(228, 228, 231),
    background: color(9, 10, 15),
    attributes: 0,
    width,
  };
}
function row(rowNumber, text) {
  return { row: rowNumber, cells: [...text].map((character) => cell(character)) };
}
function snapshot(sequence = 0) {
  return {
    sessionId: 'frontend-test',
    sequence,
    rows: 2,
    columns: 4,
    scrollback: [row(0, 'old ')],
    cells: [row(0, 'one '), row(1, 'two ')],
    title: 'initial',
    cursor: { row: 1, column: 2, visible: true },
    modes: {
      bracketedPaste: false,
      alternateScreen: false,
      appCursor: false,
      mouseClick: false,
      mouseDrag: false,
      mouseMotion: false,
      sgrMouse: false,
    },
  };
}

const first = snapshot();
const patched = protocol.applyPatch(first, {
  sessionId: first.sessionId,
  sequence: 1,
  rows: 2,
  columns: 4,
  dirtyRows: [row(1, 'new ')],
  title: null,
  titleChanged: false,
  cursor: { row: 0, column: 1, visible: true },
  modes: { ...first.modes, alternateScreen: true },
});
assert(patched?.cells[1].cells[0].text === 'n', 'dirty row patch was not applied');
assert(patched?.title === 'initial', 'unchanged title was incorrectly cleared');
assert(patched?.modes.alternateScreen === true, 'mode patch was not applied');
assert(protocol.applyPatch(first, { ...argumentsForPatch(first), sessionId: 'wrong' }) === null, 'session mismatch was accepted');
assert(protocol.isSequenceGap(0, { type: 'patch', patch: { ...argumentsForPatch(first), sequence: 2 } }), 'sequence gap was not detected');
assert(!protocol.isSequenceGap(0, { type: 'patch', patch: { ...argumentsForPatch(first), sequence: 1 } }), 'contiguous patch was treated as a gap');

const storeGaps = [];
const store = new TerminalSessionStore(() => storeGaps.push('gap'));
store.apply({ type: 'snapshot', snapshot: first });
store.apply({ type: 'patch', patch: { ...argumentsForPatch(first), sequence: 1, dirtyRows: [row(0, 'next')] } });
store.apply({ type: 'patch', patch: { ...argumentsForPatch(first), sequence: 1, dirtyRows: [row(0, 'bad!')] } });
assert(store.getSnapshot().cells[0].cells[0].text === 'n', 'duplicate patch was not suppressed');
store.apply({ type: 'patch', patch: { ...argumentsForPatch(first), sequence: 3 } });
assert(storeGaps.length === 1, 'sequence-gap resync callback was not triggered');

assert(Array.from(input.encodeKey('c', { ctrl: true }))[0] === 3, 'Ctrl-C encoding is incorrect');
assert(new TextDecoder().decode(input.encodeKey('ArrowUp', { appCursor: true })) === '\x1bOA', 'application cursor encoding is incorrect');
assert(new TextDecoder().decode(input.encodePaste('hello', true)) === '\x1b[200~hello\x1b[201~', 'bracketed paste encoding is incorrect');

const selectionSnapshot = snapshot();
selectionSnapshot.scrollback[0].cells = [cell('o'), cell('l'), cell('d'), cell(' ' )];
assert(selection.selectedText(selectionSnapshot, { start: { row: 0, column: 0 }, end: { row: 2, column: 2 } }) === 'old\none\ntwo', 'scrollback selection text is incorrect');
assert(selection.containsPoint({ start: { row: 2, column: 2 }, end: { row: 0, column: 0 } }, 1, 1), 'reverse selection range is incorrect');

console.log('Validated frontend terminal protocol, store ordering, input encoding, and selection behavior');

function argumentsForPatch(base) {
  return {
    sessionId: base.sessionId,
    sequence: 1,
    rows: base.rows,
    columns: base.columns,
    dirtyRows: [],
    title: base.title,
    titleChanged: false,
    cursor: base.cursor,
    modes: base.modes,
  };
}
