import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';
import { desktopRelayService } from '../../services/desktopRelay.service';
import { Wifi, Copy, Check, KeyRound, RefreshCw, Radio, Sparkles, Lock, ArrowRight } from 'lucide-react';

export const PairMobileModal: React.FC = () => {
  const { isPairMobileOpen, setPairMobileOpen, setProUpgradeModalOpen } = useUIStore();
  const { user } = useAuthStore();
  const [hasCopied, setHasCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'code'>('code');
  const [isRelayConnected, setIsRelayConnected] = useState(desktopRelayService.isConnected());
  const [isConnecting, setIsConnecting] = useState(false);

  const isPro = user?.plan === 'PRO';

  useEffect(() => {
    // Only connect or listen if user is PRO
    if (isPairMobileOpen && isPro) {
      if (!desktopRelayService.isConnected()) {
        setIsConnecting(true);
        // Reset connecting flag after the service's own 20s timeout
        const t = setTimeout(() => setIsConnecting(false), 22000);
        desktopRelayService.connect();
        const unsub = desktopRelayService.subscribeStatus((connected) => {
          setIsRelayConnected(connected);
          setIsConnecting(false);
        });
        return () => {
          clearTimeout(t);
          unsub();
        };
      } else {
        const unsub = desktopRelayService.subscribeStatus((connected) => {
          setIsRelayConnected(connected);
        });
        return unsub;
      }
    }
  }, [isPairMobileOpen, isPro]);

  if (!isPairMobileOpen) return null;

  if (!isPro) {
    return (
      <Modal
        isOpen={isPairMobileOpen}
        onClose={() => setPairMobileOpen(false)}
        title="Mobile Cockpit is a PRO Feature"
        subtitle="Upgrade to Orbit PRO to pair your mobile phone and receive real-time push approvals."
        maxWidth="sm"
      >
        <div className="flex flex-col items-center gap-4 font-sans text-xs pt-1 select-none text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mt-2">
            <Lock size={22} />
          </div>

          <div className="flex flex-col gap-1.5 px-4">
            <div className="flex items-center justify-center gap-1.5 font-mono font-bold text-sm text-text-primary">
              <Sparkles size={14} className="text-amber-400" />
              <span>Orbit PRO Required</span>
            </div>
            <p className="text-text-muted text-xs leading-relaxed">
              Mobile Cockpit Pairing, remote emergency controls, and instant smartphone push notifications are strictly available on the Orbit Pro tier.
            </p>
          </div>

          <div className="w-full p-3.5 rounded-xl bg-panel-elevated border border-border text-left space-y-2 mt-1">
            <div className="flex items-center gap-2 text-[11px] text-text-secondary font-mono">
              <Check size={12} className="text-emerald-400 shrink-0" />
              <span>Real-time agent question & approval push alerts</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-secondary font-mono">
              <Check size={12} className="text-emerald-400 shrink-0" />
              <span>Remote terminal prompt streaming & answers</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-secondary font-mono">
              <Check size={12} className="text-emerald-400 shrink-0" />
              <span>Emergency stop & pause from your pocket</span>
            </div>
          </div>

          <div className="w-full flex items-center justify-between gap-2 pt-3 border-t border-border mt-2">
            <button
              onClick={() => setPairMobileOpen(false)}
              className="px-3.5 py-1.5 rounded-lg hover:bg-panel border border-transparent hover:border-border text-text-secondary hover:text-text-primary font-mono text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setPairMobileOpen(false);
                setProUpgradeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <span>Upgrade to PRO ($19/mo)</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const token = desktopRelayService.getRelayToken();
  const pairingCode = desktopRelayService.getPairingCode();
  const relayUrl = (import.meta as any).env?.VITE_API_URL || 'https://orbit-cloud-backend.onrender.com';

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
                  <span className="text-emerald-400">RELAY ONLINE</span>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw size={10} className="text-amber-400 animate-spin" />
                  <span className="text-amber-400">CONNECTING…</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-rose-400">RELAY OFFLINE</span>
                </>
              )}
            </div>
            {isRelayConnected ? (
              <span className="text-[10px] font-mono text-text-dim">TLS Encrypted</span>
            ) : (
              <button
                onClick={() => {
                  setIsConnecting(true);
                  setTimeout(() => setIsConnecting(false), 22000);
                  desktopRelayService.connect();
                }}
                className="text-[10px] font-mono text-accent hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={10} />
                <span>Retry</span>
              </button>
            )}
          </div>
          <p className="text-text-muted font-mono text-[11px] leading-relaxed">
            {isRelayConnected
              ? "Your phone connects directly to this workstation. Keep Orbit open while pairing."
              : isConnecting
                ? `Connecting to ${relayUrl.replace('https://', '')}…`
                : `Could not reach ${relayUrl.replace('https://', '')}. Tap Retry or check your connection.`}
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
