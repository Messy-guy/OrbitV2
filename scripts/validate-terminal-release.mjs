import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const releaseRoot = path.join(root, 'src-tauri', 'target', 'release');
const bundleRoot = path.join(releaseRoot, 'bundle');
const binaryPath = path.join(releaseRoot, 'orbit-desktop');
const required = [
  binaryPath,
  path.join(bundleRoot, 'deb'),
];

for (const target of required) {
  if (!fs.existsSync(target)) throw new Error(`Missing release output: ${target}`);
}

const debs = fs.readdirSync(path.join(bundleRoot, 'deb')).filter(name => name.endsWith('.deb'));
if (debs.length === 0) throw new Error('No Debian package was produced');
const expectedDeb = `Orbit_${version}_amd64.deb`;
if (!debs.includes(expectedDeb)) {
  throw new Error(`Missing Debian package for version ${version}: ${expectedDeb}`);
}

if (process.platform === 'linux' && process.env.ORBIT_REQUIRE_APPIMAGE === '1') {
  const appimages = fs.existsSync(path.join(bundleRoot, 'appimage'))
    ? fs.readdirSync(path.join(bundleRoot, 'appimage')).filter(name => name.endsWith('.AppImage'))
    : [];
  const expectedAppImage = `Orbit_${version}_amd64.AppImage`;
  if (appimages.length === 0 || !appimages.includes(expectedAppImage)) {
    throw new Error(`ORBIT_REQUIRE_APPIMAGE=1 but no AppImage for version ${version} was produced`);
  }
}

const expectedAppImagePath = path.join(bundleRoot, 'appimage', `Orbit_${version}_amd64.AppImage`);

function assertElfExecutable(target, label) {
  const stats = fs.statSync(target);
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${target}`);
  }
  const descriptor = fs.openSync(target, 'r');
  const header = Buffer.alloc(4);
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error(`${label} does not have an ELF header: ${target}`);
  }
}

if (process.platform === 'linux') {
  assertElfExecutable(binaryPath, 'Release binary');
  if (fs.existsSync(expectedAppImagePath)) {
    assertElfExecutable(expectedAppImagePath, 'AppImage');
  }
}

if (process.env.ORBIT_VALIDATE_NATIVE_SMOKE === '1') {
  const smokeEnvironment = {
    ...process.env,
    ORBIT_TERMINAL_HEADLESS_SMOKE: '1',
  };
  if (process.env.ORBIT_VALIDATE_PROVIDER_MATRIX === '1') {
    smokeEnvironment.ORBIT_TERMINAL_PROVIDER_MATRIX = '1';
  }
  const result = spawnSync(binaryPath, [], {
    env: smokeEnvironment,
    encoding: 'utf8',
  });
  // Some managed sandboxes report EPERM after allowing the child to finish;
  // a zero exit status plus smoke output is still authoritative in that case.
  if (result.error && !(result.error.code === 'EPERM' && result.status === 0)) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Native terminal smoke failed:\n${result.stdout}\n${result.stderr}`);
  }
}

if (process.env.ORBIT_VALIDATE_APPIMAGE_SMOKE === '1') {
  if (!fs.existsSync(expectedAppImagePath)) {
    throw new Error(`ORBIT_VALIDATE_APPIMAGE_SMOKE=1 but no AppImage exists: ${expectedAppImagePath}`);
  }
  const appImageEnvironment = {
    ...process.env,
    ORBIT_TERMINAL_HEADLESS_SMOKE: '1',
  };
  if (process.env.ORBIT_VALIDATE_PROVIDER_MATRIX === '1') {
    appImageEnvironment.ORBIT_TERMINAL_PROVIDER_MATRIX = '1';
  }
  const result = spawnSync(
    'timeout',
    ['--kill-after=5s', '90s', expectedAppImagePath, '--appimage-extract-and-run'],
    {
      env: appImageEnvironment,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(`AppImage native smoke failed:\n${result.stdout}\n${result.stderr}`);
  }
}

if (process.env.ORBIT_VALIDATE_GUI_SMOKE === '1') {
  const runner = spawnSync('sh', ['-lc', 'command -v xvfb-run && command -v timeout'], {
    encoding: 'utf8',
  });
  if (runner.status !== 0) {
    throw new Error('ORBIT_VALIDATE_GUI_SMOKE=1 requires xvfb-run and timeout');
  }

  const guiCommand = fs.existsSync(expectedAppImagePath)
    ? [expectedAppImagePath, '--appimage-extract-and-run']
    : [binaryPath];
  const result = spawnSync(
    'timeout',
    [
      '--signal=TERM',
      '--kill-after=3s',
      '12s',
      'xvfb-run',
      '--auto-servernum',
      '--server-args=-screen 0 1440x1000x24',
      ...guiCommand,
    ],
    {
      env: {
        ...process.env,
        GDK_BACKEND: 'x11',
        WEBKIT_DISABLE_DMABUF_RENDERER: '1',
      },
      encoding: 'utf8',
    },
  );
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/(failed to initialize gtk|orbit panic|panicked at)/i.test(output)) {
    throw new Error(`Packaged GUI smoke reported a desktop startup failure:\n${output}`);
  }
  // timeout(1) returns 124 for a healthy app that stayed alive until the
  // bounded probe ended.  143/137 indicate the bounded termination reached
  // the child directly. A clean early exit is a startup failure here.
  if (![124, 137, 143].includes(result.status)) {
    throw new Error(`Packaged GUI smoke exited with status ${result.status}:\n${output}`);
  }
}

console.log(`Validated native terminal release outputs: ${debs.length} Debian package(s)`);
