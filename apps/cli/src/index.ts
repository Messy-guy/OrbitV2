#!/usr/bin/env node

import { OrbitTUI } from './ui/tui.js';
import { CommandRouter } from './commands/router.js';

async function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const router = new CommandRouter(cwd);
  const tui = new OrbitTUI(cwd);

  if (args.length === 0) {
    await tui.startMenu();
    return;
  }

  const rawCmd = args[0].startsWith('/') ? args[0] : `/${args[0]}`;
  const fullCommand = `${rawCmd} ${args.slice(1).join(' ')}`.trim();

  if (router.isOrbitCommand(fullCommand)) {
    const result = await router.handleCommand(fullCommand);
    if (result.message) {
      console.log(result.message);
    }
    if (result.action === 'new' && result.targetSession) {
      await tui.attachToSession(result.targetSession);
    } else if (result.action === 'switch' && result.targetSession) {
      await tui.attachToSession(result.targetSession);
    }
  } else {
    console.log(`Unknown command '${args[0]}'. Run \`orbit help\` or launch interactive mode with \`orbit\`.`);
  }
}

main().catch((err) => {
  console.error('Orbit CLI error:', err);
  process.exit(1);
});
