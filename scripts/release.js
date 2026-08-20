import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const tauriPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

// Read existing configs
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));

// Increment patch version (0.1.0 -> 0.1.1)
const parts = pkg.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1;
const nextVersion = parts.join('.');

console.log(`\n🚀 Bumping Orbit version: ${pkg.version} -> ${nextVersion}`);

// Write back updated versions
pkg.version = nextVersion;
tauri.version = nextVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');

console.log(`✅ Updated package.json and tauri.conf.json to v${nextVersion}`);

// Commit, tag and push to trigger automated GitHub Release build
try {
  console.log(`📦 Committing, tagging, and pushing v${nextVersion} to GitHub...`);
  execSync('git add package.json src-tauri/tauri.conf.json', { stdio: 'inherit', cwd: rootDir });
  execSync(`git commit -m "chore(release): v${nextVersion}"`, { stdio: 'inherit', cwd: rootDir });
  execSync(`git tag v${nextVersion}`, { stdio: 'inherit', cwd: rootDir });
  execSync('git push origin main && git push origin --tags', { stdio: 'inherit', cwd: rootDir });
  console.log(`\n🎉 Release v${nextVersion} triggered! GitHub Actions is now compiling the Windows & Linux auto-updates.\n`);
} catch (err) {
  console.error('❌ Failed to commit and push release tag:', err.message);
  process.exit(1);
}
