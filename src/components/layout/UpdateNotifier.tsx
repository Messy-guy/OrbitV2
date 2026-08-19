import React, { useEffect, useState } from 'react';
import { Sparkles, Download, RefreshCw, X } from 'lucide-react';
import { isTauriAvailable } from '../../services';

export const UpdateNotifier: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadedPercent, setDownloadedPercent] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauriAvailable()) return;

    const checkForUpdates = async () => {
      try {
        const updater = (window as any).__TAURI__?.updater;
        if (!updater) return;
        const update = await updater.check();
        if (update?.available) {
          setUpdateAvailable(true);
          setNewVersion(update.version || 'latest');
        }
      } catch (err) {
        console.warn('Auto-updater check skipped or unavailable:', err);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInstallUpdate = async () => {
    try {
      setIsUpdating(true);
      const updater = (window as any).__TAURI__?.updater;
      const process = (window as any).__TAURI__?.process;
      if (!updater) return;

      const update = await updater.check();
      if (update?.available) {
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event: any) => {
          switch (event?.event) {
            case 'Started':
              contentLength = event.data?.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data?.chunkLength || 0;
              if (contentLength > 0) {
                setDownloadedPercent(Math.round((downloaded / contentLength) * 100));
              }
              break;
            case 'Finished':
              break;
          }
        });

        if (process?.relaunch) {
          await process.relaunch();
        }
      }
    } catch (err) {
      console.error('Failed to install update:', err);
      setIsUpdating(false);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-3.5 bg-[#121318]/95 backdrop-blur-xl border border-white/[0.15] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.8)] flex items-center gap-3 text-xs font-mono text-white max-w-md">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
          <Sparkles size={16} />
        </div>

        <div className="flex-1 pr-2">
          <div className="font-bold flex items-center gap-1.5">
            <span>Orbit Update Available</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 text-[10px]">
              v{newVersion}
            </span>
          </div>
          <p className="text-[11px] text-[#8e93a0] font-sans mt-0.5">
            {isUpdating ? `Downloading update (${downloadedPercent}%)...` : 'A new version of Orbit is ready to install.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-white/90 text-black font-mono font-extrabold text-xs rounded-lg transition-all shadow cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <RefreshCw size={12} className="animate-spin text-black" />
            ) : (
              <Download size={12} className="text-black" />
            )}
            <span>{isUpdating ? 'Updating...' : 'Update & Restart'}</span>
          </button>

          {!isUpdating && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-[#71717a] hover:text-white rounded hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
