import React, { useEffect, useState } from 'react';
import { Sparkles, Download, RefreshCw, X, ExternalLink } from 'lucide-react';
import { isTauriAvailable, tauriService } from '../../services';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import packageJson from '../../../package.json';

export const UpdateNotifier: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadedPercent, setDownloadedPercent] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);
  const [updateObj, setUpdateObj] = useState<Update | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  useEffect(() => {
    const checkForUpdates = async () => {
      // 1. Primary: Native Tauri Updater Plugin
      if (isTauriAvailable()) {
        try {
          const update = await check();
          if (update) {
            console.log('🚀 [Orbit Updater] Native updater detected version:', update.version);
            setUpdateObj(update);
            setUpdateAvailable(true);
            setNewVersion(update.version || 'latest');
            return;
          }
        } catch (err) {
          console.warn('[Orbit Updater] Native updater check error (falling back to GitHub API):', err);
        }
      }

      // 2. Fallback / Universal: Direct GitHub Releases API Check
      try {
        const currentVersion = packageJson.version || '0.1.0';
        const res = await fetch('https://api.github.com/repos/Messy-guy/OrbitV2/releases/latest', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const latestTag = data.tag_name?.replace(/^v/, '');
          if (latestTag && isNewerVersion(currentVersion, latestTag)) {
            console.log(`🚀 [Orbit Updater] GitHub API detected newer version: v${latestTag} (current: v${currentVersion})`);
            setUpdateAvailable(true);
            setNewVersion(latestTag);
            setDownloadUrl(data.html_url || 'https://github.com/Messy-guy/OrbitV2/releases/latest');
          }
        }
      } catch (e) {
        // Silently ignore network failures
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isNewerVersion = (current: string, latest: string): boolean => {
    const curParts = current.split('.').map(n => parseInt(n, 10) || 0);
    const latParts = latest.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
      const c = curParts[i] || 0;
      const l = latParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const handleInstallUpdate = async () => {
    if (updateObj) {
      try {
        setIsUpdating(true);
        let downloaded = 0;
        let contentLength = 0;

        await updateObj.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength || 0;
              if (contentLength > 0) {
                setDownloadedPercent(Math.round((downloaded / contentLength) * 100));
              }
              break;
            case 'Finished':
              break;
          }
        });

        await relaunch();
      } catch (err) {
        console.error('[Orbit Updater] Failed to install update via plugin:', err);
        setIsUpdating(false);
        if (downloadUrl) {
          tauriService.openExternalUrl(downloadUrl);
        }
      }
    } else if (downloadUrl) {
      tauriService.openExternalUrl(downloadUrl);
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
            {isUpdating ? `Downloading update (${downloadedPercent}%)...` : 'A new version of Orbit Studio is ready.'}
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
            ) : updateObj ? (
              <Download size={12} className="text-black" />
            ) : (
              <ExternalLink size={12} className="text-black" />
            )}
            <span>{isUpdating ? 'Updating...' : updateObj ? 'Update & Restart' : 'Get Update'}</span>
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
