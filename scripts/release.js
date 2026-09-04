import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const mobilePkgPath = path.join(rootDir, 'apps', 'mobile', 'package.json');
const mobileAppJsonPath = path.join(rootDir, 'apps', 'mobile', 'app.json');
const tauriPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

// Read existing configs
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
const mobilePkg = fs.existsSync(mobilePkgPath) ? JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8')) : null;
const mobileAppJson = fs.existsSync(mobileAppJsonPath) ? JSON.parse(fs.readFileSync(mobileAppJsonPath, 'utf8')) : null;

// Check target from CLI arguments
const targetArg = process.argv.slice(2).find(a => a.startsWith('--target='))?.split('=')[1]
  || process.argv.slice(2).find(a => ['desktop', 'mobile', 'all'].includes(a))
  || 'all';

// Increment patch version (0.1.0 -> 0.1.1)
const parts = pkg.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1;
const nextVersion = parts.join('.');

console.log(`\n🚀 Bumping Orbit version: ${pkg.version} -> ${nextVersion} (Target: ${targetArg})`);

// Write back updated versions
pkg.version = nextVersion;
if (targetArg === 'all' || targetArg === 'desktop') {
  tauri.version = nextVersion;
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
}
if (targetArg === 'all' || targetArg === 'mobile') {
  if (mobilePkg) {
    mobilePkg.version = nextVersion;
    fs.writeFileSync(mobilePkgPath, JSON.stringify(mobilePkg, null, 2) + '\n');
  }
  if (mobileAppJson && mobileAppJson.expo) {
    mobileAppJson.expo.version = nextVersion;
    fs.writeFileSync(mobileAppJsonPath, JSON.stringify(mobileAppJson, null, 2) + '\n');
  }
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✅ Updated version configs to v${nextVersion}`);

const tagPrefix = targetArg === 'desktop' ? 'desktop-v' : targetArg === 'mobile' ? 'mobile-v' : 'v';
const tagName = `${tagPrefix}${nextVersion}`;

// Commit, tag and push to trigger automated GitHub Release build
try {
  console.log(`📦 Committing, tagging, and pushing ${tagName} to GitHub...`);
  execSync('git add -A', { stdio: 'inherit', cwd: rootDir });
  execSync(`git commit -m "chore(release): ${tagName}"`, { stdio: 'inherit', cwd: rootDir });
  execSync(`git tag ${tagName}`, { stdio: 'inherit', cwd: rootDir });
  execSync('git push origin main && git push origin --tags', { stdio: 'inherit', cwd: rootDir });
  console.log(`\n🎉 Release ${tagName} triggered! GitHub Actions is now compiling for target: ${targetArg}.\n`);
} catch (err) {
  console.error('❌ Failed to commit and push release tag:', err.message);
  process.exit(1);
}
