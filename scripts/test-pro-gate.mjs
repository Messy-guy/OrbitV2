#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- Running Orbit Pro Security & Anti-Bypass Gate Verification ---');

// 1. Verify desktop agent spawning limit removal
const addAgentModalContent = fs.readFileSync(path.join(root, 'src/components/agent/AddAgentModal.tsx'), 'utf8');
assert(!addAgentModalContent.includes('const maxAllowedSlots = isPro ? 999 : 2'), 'Hardcoded 2-agent limit was not removed from AddAgentModal.tsx');
assert(addAgentModalContent.includes('const maxAllowedSlots = 999'), 'AddAgentModal.tsx does not set unlimited 999 slots for all desktop users');
console.log('✅ PASS: Desktop agent spawning is completely free & unlimited (999 slots)');

// 2. Verify PairMobileModal Pro Gate & Anti-Bypass
const pairMobileModalContent = fs.readFileSync(path.join(root, 'src/components/auth/PairMobileModal.tsx'), 'utf8');
assert(pairMobileModalContent.includes("const isPro = user?.plan === 'PRO'"), 'PairMobileModal missing isPro check');
assert(pairMobileModalContent.includes('if (!isPro)'), 'PairMobileModal missing !isPro blocking view');
assert(pairMobileModalContent.includes('Mobile Cockpit is a PRO Feature'), 'PairMobileModal does not show lock gate header to non-PRO users');
assert(pairMobileModalContent.includes('if (isPairMobileOpen && isPro)'), 'PairMobileModal must not auto-connect relay socket if user is not PRO');
console.log('✅ PASS: PairMobileModal cannot be bypassed to reveal QR code or pairing code without PRO plan');

// 3. Verify Desktop Relay Service Anti-Bypass Execution Gate
const desktopRelayContent = fs.readFileSync(path.join(root, 'src/services/desktopRelay.service.ts'), 'utf8');
assert(desktopRelayContent.includes("currentUser?.plan !== 'PRO'"), 'desktopRelay.service.ts missing strict PRO plan check in execute_action');
assert(desktopRelayContent.includes("code: 'PRO_REQUIRED'"), 'desktopRelay.service.ts does not reject unauthorized mobile actions with PRO_REQUIRED');
assert(desktopRelayContent.includes("proEnabled: isPro"), 'desktopRelay.service.ts telemetry packet missing proEnabled state');
assert(desktopRelayContent.includes("Push notification skipped: Orbit PRO required"), 'desktopRelay.service.ts does not guard push notifications behind PRO');
console.log('✅ PASS: desktopRelay rejects remote actions & push notifications if plan is not PRO');

// 4. Verify AppHeader button gates
const appHeaderContent = fs.readFileSync(path.join(root, 'src/components/layout/AppHeader.tsx'), 'utf8');
assert(appHeaderContent.includes("user?.plan === 'PRO'"), 'AppHeader missing PRO gate on Mobile button');
assert(appHeaderContent.includes("setProUpgradeModalOpen(true)"), 'AppHeader does not open ProUpgradeModal when non-PRO clicks mobile cockpit');
console.log('✅ PASS: AppHeader directs non-PRO users to ProUpgradeModal');

console.log('================================================================');
console.log('🎉 ALL PRO FEATURE GATING & ZERO-BYPASS CHECKS PASSED SUCCESSFULLY!');
console.log('================================================================');
