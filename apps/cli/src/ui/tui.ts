import * as readline from 'readline';
import { spawn } from 'child_process';
import { SessionManager } from '../multiplexer/sessionManager.js';
import { CommandRouter } from '../commands/router.js';
import { OrbitSession, AgentProvider } from '../types.js';

export class OrbitTUI {
  private sessionManager: SessionManager;
  private commandRouter: CommandRouter;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.sessionManager = new SessionManager(cwd);
    this.commandRouter = new CommandRouter(cwd);
  }

  public printBanner() {
    console.clear();
    console.log(`\x1b[36m
   ██████╗ ██████╗ ██████╗ ██╗████████╗
  ██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝
  ██║   ██║██████╔╝██████╔╝██║   ██║   
  ██║   ██║██╔══██╗██╔══██╗██║   ██║   
  ╚██████╔╝██║  ██║██████╔╝██║   ██║   
   ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   
    Central Agent Control Layer
\x1b[0m`);
    console.log(`  \x1b[90mProject CWD: ${this.cwd}\x1b[0m\n`);
  }

  public async startMenu(): Promise<void> {
    this.printBanner();
    const sessions = this.sessionManager.listSessions();

    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │  Active Project Sessions                             │');
    console.log('  │                                                      │');

    if (sessions.length === 0) {
      console.log('  │  (No active sessions)                                │');
    } else {
      sessions.forEach((s, idx) => {
        const dot = s.status === 'working' ? '\x1b[32m● working\x1b[0m' : s.status === 'idle' ? '\x1b[33m○ idle\x1b[0m' : '\x1b[90m⨯ stopped\x1b[0m';
        const line = `  │  ${idx + 1}  \x1b[1m${s.provider.padEnd(10)}\x1b[0m ${s.name.padEnd(16)} ${dot}`;
        console.log(line);
      });
    }

    console.log('  │                                                      │');
    console.log('  │  +  [N] Launch new session                           │');
    console.log('  │  ?  [H] Help / Commands                              │');
    console.log('  │  q  [Q] Exit Orbit                                   │');
    console.log('  └──────────────────────────────────────────────────────┘\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('  Select option or session number: ', async (ans) => {
        rl.close();
        const trimmed = ans.trim().toLowerCase();

        if (trimmed === 'q' || trimmed === 'exit') {
          console.log('Goodbye!');
          resolve();
          return;
        }

        if (trimmed === 'n' || trimmed === '+') {
          await this.promptNewSession();
          resolve();
          return;
        }

        if (trimmed === 'h' || trimmed === '?') {
          const res = await this.commandRouter.handleCommand('/help');
          console.log(res.message);
          await this.pause();
          await this.startMenu();
          resolve();
          return;
        }

        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= sessions.length) {
          const selected = sessions[num - 1];
          await this.attachToSession(selected);
          resolve();
          return;
        }

        console.log('\x1b[31mInvalid selection.\x1b[0m');
        await this.pause();
        await this.startMenu();
        resolve();
      });
    });
  }

  public async promptNewSession(): Promise<void> {
    console.log('\n  \x1b[1mLaunch New Agent Session\x1b[0m');
    const available = this.sessionManager.detectAvailableProviders();
    console.log('  Available Providers:');
    available.forEach((a, i) => {
      console.log(`    ${i + 1}. ${a.provider} (${a.executable})`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\n  Choose Agent Provider (number or name): ', (choice) => {
        let provider: AgentProvider = 'claude';
        const num = parseInt(choice.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= available.length) {
          provider = available[num - 1].provider;
        } else if (choice.trim()) {
          provider = choice.trim().toLowerCase() as AgentProvider;
        }

        rl.question(`  Session name [${provider}-session]: `, async (nameAns) => {
          rl.close();
          const name = nameAns.trim() || `${provider}-session`;
          const session = this.sessionManager.createSession(provider, name);
          console.log(`\n  \x1b[32m✔ Created session ${session.name}\x1b[0m`);
          await this.attachToSession(session);
          resolve();
        });
      });
    });
  }

  public async attachToSession(session: OrbitSession, initialCommand?: string): Promise<void> {
    console.clear();
    console.log(`\x1b[36m--- Attached to Orbit Session: ${session.name} (${session.provider}) ---\x1b[0m`);
    console.log(`\x1b[90m(Orbit Control: type /detach, /switch, /skills, /handoff, or /help)\x1b[0m\n`);

    this.sessionManager.updateSessionStatus(session.id, 'working');

    // Launch real child CLI process
    const child = spawn(session.executable, session.args, {
      cwd: session.cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ORBIT_SESSION_ID: session.id,
        ORBIT_PROVIDER: session.provider
      }
    });

    this.sessionManager.updateSessionStatus(session.id, 'working', child.pid);

    return new Promise((resolve) => {
      child.on('error', (err) => {
        console.error(`\x1b[31mFailed to start ${session.executable}: ${err.message}\x1b[0m`);
        this.sessionManager.updateSessionStatus(session.id, 'stopped');
      });

      child.on('exit', (code) => {
        console.log(`\n\x1b[90mProcess exited with code ${code}.\x1b[0m`);
        this.sessionManager.updateSessionStatus(session.id, 'stopped');
        this.startMenu().then(resolve);
      });
    });
  }

  private pause(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise((resolve) => {
      rl.question('\n  Press Enter to continue...', () => {
        rl.close();
        resolve();
      });
    });
  }
}
