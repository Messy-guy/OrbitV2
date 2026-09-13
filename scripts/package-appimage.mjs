#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const appImageDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'appimage');
const appDir = path.join(appImageDir, 'Orbit.AppDir');
const expectedName = `Orbit_${version}_amd64.AppImage`;
const expectedPath = path.join(appImageDir, expectedName);

function executableCandidates() {
  const homeDir = process.env.HOME || os.homedir();
  return [
    process.env.LINUXDEPLOY,
    path.join(homeDir, '.cache', 'tauri', 'linuxdeploy-x86_64.AppImage'),
    '/home/runner/.cache/tauri/linuxdeploy-x86_64.AppImage',
    '/root/.cache/tauri/linuxdeploy-x86_64.AppImage',
  ].filter(Boolean);
}

function appImagePluginCandidates() {
  const homeDir = process.env.HOME || os.homedir();
  return [
    process.env.LINUXDEPLOY_PLUGIN_APPIMAGE,
    path.join(homeDir, '.cache', 'tauri', 'linuxdeploy-plugin-appimage.AppImage'),
    '/home/runner/.cache/tauri/linuxdeploy-plugin-appimage.AppImage',
    '/root/.cache/tauri/linuxdeploy-plugin-appimage.AppImage',
  ].filter(Boolean);
}

function runtimeCandidates() {
  const homeDir = process.env.HOME || os.homedir();
  return [
    process.env.APPIMAGE_RUNTIME_FILE,
    path.join(homeDir, '.cache', 'tauri', 'runtime-x86_64'),
    path.join(homeDir, '.cache', 'appimage', 'runtime-x86_64'),
    '/home/runner/.cache/tauri/runtime-x86_64',
    '/root/.cache/tauri/runtime-x86_64',
  ].filter(Boolean);
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runLinuxDeploy(binaryPath, cwd) {
  const isAppImage = binaryPath.endsWith('.AppImage');
  const args = [
    ...(isAppImage ? ['--appimage-extract-and-run'] : []),
    '--appdir',
    appDir,
    '--output',
    'appimage',
  ];

  return spawnSync(binaryPath, args, {
    cwd,
    env: {
      ...process.env,
      APPIMAGE_EXTRACT_AND_RUN: '1',
    },
    encoding: 'utf8',
    timeout: 180_000,
    stdio: 'inherit',
  });
}

function runAppImagePlugin(binaryPath) {
  return spawnSync(binaryPath, [
    '--appimage-extract-and-run',
    '--appdir',
    appDir,
  ], {
    cwd: appImageDir,
    env: {
      ...process.env,
      APPIMAGE_EXTRACT_AND_RUN: '1',
    },
    encoding: 'utf8',
    timeout: 180_000,
    stdio: 'inherit',
  });
}

function extractAppImage(binaryPath) {
  const extractionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-appimagetool-'));
  const extract = spawnSync(binaryPath, ['--appimage-extract'], {
    cwd: extractionRoot,
    env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' },
    encoding: 'utf8',
    timeout: 60_000,
    stdio: 'inherit',
  });
  if (extract.status !== 0) {
    fs.rmSync(extractionRoot, { recursive: true, force: true });
    throw new Error(`AppImage tool extraction failed with status ${extract.status}`);
  }
  return extractionRoot;
}

function ensureRuntime(extractionRoot) {
  const existing = runtimeCandidates().find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  if (existing) return existing;

  const downloaded = path.join(extractionRoot, 'runtime-x86_64');
  const runtimeUrl = 'https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64';
  const curl = spawnSync('curl', [
    '--fail',
    '--location',
    '--retry',
    '3',
    '--connect-timeout',
    '15',
    runtimeUrl,
    '--output',
    downloaded,
  ], {
    encoding: 'utf8',
    timeout: 180_000,
    stdio: 'inherit',
  });
  if (curl.status !== 0) {
    const wget = spawnSync('wget', ['--tries=3', '--timeout=15', '--output-document', downloaded, runtimeUrl], {
      encoding: 'utf8',
      timeout: 180_000,
      stdio: 'inherit',
    });
    if (wget.status !== 0) {
      throw new Error(`Unable to obtain the AppImage runtime from ${runtimeUrl}`);
    }
  }
  fs.chmodSync(downloaded, fs.statSync(downloaded).mode | 0o111);
  return downloaded;
}

function runExtractedAppImageTool(binaryPath) {
  const extractionRoot = extractAppImage(binaryPath);
  try {
    const appImageTool = path.join(
      extractionRoot,
      'squashfs-root',
      'appimagetool-prefix',
      'usr',
      'bin',
      'appimagetool',
    );
    if (!isExecutable(appImageTool)) {
      throw new Error(`extracted appimagetool executable was not found at ${appImageTool}`);
    }
    const runtime = ensureRuntime(extractionRoot);
    const result = spawnSync(appImageTool, ['--runtime-file', runtime, appDir], {
      cwd: appImageDir,
      env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' },
      encoding: 'utf8',
      timeout: 180_000,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`extracted appimagetool failed with status ${result.status}`);
    }
  } finally {
    fs.rmSync(extractionRoot, { recursive: true, force: true });
  }
}

function runExtractedLinuxDeploy(appImagePath) {
  const extractionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-linuxdeploy-'));
  try {
    const extract = spawnSync(appImagePath, ['--appimage-extract'], {
      cwd: extractionRoot,
      env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' },
      encoding: 'utf8',
      timeout: 60_000,
      stdio: 'inherit',
    });
    if (extract.status !== 0) {
      throw new Error(`linuxdeploy extraction failed with status ${extract.status}`);
    }

    const extractedBinary = path.join(extractionRoot, 'squashfs-root', 'usr', 'bin', 'linuxdeploy');
    if (!isExecutable(extractedBinary)) {
      throw new Error(`extracted linuxdeploy executable was not found at ${extractedBinary}`);
    }
    const result = runLinuxDeploy(extractedBinary, appImageDir);
    if (result.status !== 0) {
      throw new Error(`extracted linuxdeploy failed with status ${result.status}`);
    }
  } finally {
    fs.rmSync(extractionRoot, { recursive: true, force: true });
  }
}

function normalizeDesktopIcon() {
  // Tauri's AppDir can contain the generated icon as Orbit.png while its
  // desktop entry names the application icon orbit-desktop. appimagetool
  // treats a missing named icon as a hard packaging error, so provide the
  // conventional root-level alias before invoking either packager.
  const generatedIcon = path.join(appDir, 'Orbit.png');
  const namedIcon = path.join(appDir, 'orbit-desktop.png');
  if (fs.existsSync(generatedIcon) && !fs.existsSync(namedIcon)) {
    fs.copyFileSync(generatedIcon, namedIcon);
  }
}

if (!fs.existsSync(appDir)) {
  throw new Error(`Tauri did not produce the AppDir at ${appDir}`);
}
fs.mkdirSync(appImageDir, { recursive: true });
normalizeDesktopIcon();

if (fs.existsSync(expectedPath) && process.env.ORBIT_REPACKAGE_APPIMAGE !== '1') {
  fs.chmodSync(expectedPath, fs.statSync(expectedPath).mode | 0o111);
  console.log(`AppImage already exists: ${expectedPath}`);
  process.exit(0);
}

const appImagePlugin = appImagePluginCandidates().find(isExecutable);
const linuxDeploy = executableCandidates().find(isExecutable);
if (!appImagePlugin && !linuxDeploy) {
  throw new Error(
    'The linuxdeploy AppImage plugin was not found. Set LINUXDEPLOY_PLUGIN_APPIMAGE or install the Tauri linuxdeploy cache before packaging an AppImage.',
  );
}

let result;
if (appImagePlugin) {
  console.log(`Packaging AppImage from ${appDir} with ${appImagePlugin}`);
  result = runAppImagePlugin(appImagePlugin);
  if (result.status !== 0) {
    console.warn('linuxdeploy AppImage plugin could not obtain a runtime; retrying with extracted appimagetool.');
    runExtractedAppImageTool(appImagePlugin);
  }
} else {
  console.log(`Packaging AppImage from ${appDir} with ${linuxDeploy}`);
  result = runLinuxDeploy(linuxDeploy, appImageDir);
  if (result.status !== 0 && linuxDeploy.endsWith('.AppImage')) {
    console.warn('linuxdeploy could not run directly; retrying from a FUSE-independent extraction.');
    runExtractedLinuxDeploy(linuxDeploy);
  } else if (result.status !== 0) {
    throw new Error(`linuxdeploy failed with status ${result.status}`);
  }
}

const produced = fs
  .readdirSync(appImageDir)
  .filter((name) => name.endsWith('.AppImage'))
  .map((name) => path.join(appImageDir, name));
const sourcePath = produced.find((candidate) => candidate === expectedPath)
  || produced.find((candidate) => path.basename(candidate) === 'Orbit-x86_64.AppImage')
  || produced.find((candidate) => path.basename(candidate).startsWith('Orbit'));

if (!sourcePath || !fs.existsSync(sourcePath)) {
  throw new Error(`linuxdeploy completed without producing an AppImage in ${appImageDir}`);
}
if (sourcePath !== expectedPath) {
  fs.renameSync(sourcePath, expectedPath);
}
fs.chmodSync(expectedPath, fs.statSync(expectedPath).mode | 0o111);
console.log(`AppImage ready: ${expectedPath}`);
