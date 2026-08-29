import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';
import { desktopRelayService } from '../../services/desktopRelay.service';
import { Wifi, Copy, Check, KeyRound, RefreshCw, Radio } from 'lucide-react';

export const PairMobileModal: React.FC = () => {
  const { isPairMobileOpen, setPairMobileOpen } = useUIStore();
  const { user } = useAuthStore();
  const [hasCopied, setHasCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'code'>('code');
  const [isRelayConnected, setIsRelayConnected] = useState(desktopRelayService.isConnected());

  useEffect(() => {
    if (isPairMobileOpen) {
      desktopRelayService.connect();
      const unsub = desktopRelayService.subscribeStatus((connected) => {
        setIsRelayConnected(connected);
      });
      return unsub;
    }
  }, [isPairMobileOpen]);

  if (!isPairMobileOpen) return null;

  const token = desktopRelayService.getRelayToken();
  const pairingCode = desktopRelayService.getPairingCode();
  const relayUrl = (import.meta as any).env?.VITE_API_URL || 'http://192.168.18.60:3000';

  const pairingPayload = JSON.stringify({
    type: 'orbit_pair',
    version: '1.0',
    userId: user?.id || 'dev-user-default',
    token: token,
    code: pairingCode,
    relayUrl: relayUrl,
    issuedAt: Date.now(),
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isPairMobileOpen}
      onClose={() => setPairMobileOpen(false)}
      title="Link Mobile Cockpit"
      subtitle="Pair your phone with your desktop in seconds"
      maxWidth="sm"
    >
      <div className="flex flex-col items-center gap-4 font-sans text-xs pt-1 select-none">
        
        {/* Toggle Mode: 6-Digit Code vs QR Code */}
        <div className="w-full flex rounded-xl bg-panel border border-border p-1 gap-1">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'bg-text-primary text-background shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            6-Digit Code
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-text-primary text-background shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Scan QR
          </button>
        </div>

        {activeTab === 'code' ? (
          /* OTP 6-Digit Display Box */
          <div className="w-full flex flex-col items-center justify-center p-6 bg-well rounded-2xl border border-border gap-3">
            <div className="flex items-center gap-2 text-text-dim text-[11px] font-mono">
              <KeyRound size={13} className="text-accent" />
              <span>ENTER THIS CODE ON YOUR PHONE</span>
            </div>
            
            <div className="flex items-center gap-2 tracking-[0.35em] font-mono font-extrabold text-3xl text-text-primary bg-panel px-6 py-3 rounded-xl border border-border select-all">
              {pairingCode.slice(0, 3)} {pairingCode.slice(3)}
            </div>

            <p className="text-[11px] text-text-muted text-center font-mono">
              Open Orbit Mobile → <b>Sync</b> tab → type this 6-digit code
            </p>
          </div>
        ) : (
          /* QR Code Container */
          <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-border">
            <QRCodeSVG
              value={pairingPayload}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
        )}

        {/* Security / Relay Info */}
        <div className="w-full p-3 rounded-xl bg-well border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono font-bold text-[11px]">
              {isRelayConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400">RELAY WORKSTATION ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400">CONNECTING TO RELAY...</span>
                </>
              )}
            </div>
            {!isRelayConnected ? (
              <button
                onClick={() => desktopRelayService.connect()}
                className="text-[10px] font-mono text-accent hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={10} />
                <span>Retry</span>
              </button>
            ) : (
              <span className="text-[10px] font-mono text-text-dim">TLS Encrypted</span>
            )}
          </div>
          <p className="text-text-muted font-mono text-[11px] leading-relaxed">
            {isRelayConnected
              ? "Your phone connects directly to this workstation. Keep Orbit open while pairing."
              : "Reconnecting to local relay server at http://localhost:3000..."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-border">
          {activeTab === 'code' ? (
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel hover:bg-panel-elevated border border-border text-text-secondary hover:text-text-primary text-xs font-mono transition-colors cursor-pointer"
            >
              {hasCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{hasCopied ? 'Code Copied' : 'Copy Code'}</span>
            </button>
          ) : (
            <div />
          )}

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
