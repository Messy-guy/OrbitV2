import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';
import { Smartphone, Wifi, ShieldCheck, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export const PairMobileModal: React.FC = () => {
  const { isPairMobileOpen, setPairMobileOpen } = useUIStore();
  const { tokens, user } = useAuthStore();
  const [hasCopied, setHasCopied] = useState(false);

  if (!isPairMobileOpen) return null;

  const token = tokens?.accessToken || (user ? `orbit_dev_${user.id}_${Date.now()}` : 'orbit_dev_master_token');
  const pairingPayload = JSON.stringify({
    type: 'orbit_pair',
    version: '1.0',
    userId: user?.id || 'dev-user-default',
    token: token,
    relayUrl: (import.meta as any).env?.VITE_API_URL || 'http://192.168.18.60:3000',
    issuedAt: Date.now(),
  });

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(pairingPayload);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isPairMobileOpen}
      onClose={() => setPairMobileOpen(false)}
      title="Pair Orbit Mobile Cockpit"
      subtitle="Scan with your phone to link your workstation in 1 tap"
      maxWidth="sm"
    >
      <div className="flex flex-col items-center gap-4 font-sans text-xs pt-1 select-none">
        
        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-border">
          <QRCodeSVG
            value={pairingPayload}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Security / Tunnel Info */}
        <div className="w-full p-3 rounded-xl bg-well border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold text-[11px]">
              <Wifi size={12} className="animate-pulse" />
              <span>END-TO-END ENCRYPTED RELAY</span>
            </div>
            <span className="text-[10px] font-mono text-text-dim">TLS 1.3</span>
          </div>
          <p className="text-text-muted font-mono text-[11px] leading-relaxed">
            Your phone connects via an outbound authenticated cloud tunnel. No open ports or firewall rules required.
          </p>
        </div>

        {/* Quick Copy Link Option */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={handleCopyPayload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel hover:bg-panel-elevated border border-border text-text-secondary hover:text-text-primary text-xs font-mono transition-colors cursor-pointer"
          >
            {hasCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{hasCopied ? 'Copied Token' : 'Copy Pairing Payload'}</span>
          </button>

          <button
            onClick={() => setPairMobileOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Done
          </button>
        </div>

      </div>
    </Modal>
  );
};
