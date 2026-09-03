import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

class MobileAppUpdateService {
  private checked = false;

  /**
   * Check GitHub Releases API for newer APK releases
   */
  async checkForUpdates(silent = true) {
    if (this.checked && silent) return;
    this.checked = true;

    try {
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      const response = await fetch('https://api.github.com/repos/Messy-guy/OrbitV2/releases/latest', {
        headers: {
          'User-Agent': 'Orbit-Mobile-App',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) return;

      const release: GitHubRelease = await response.json();
      const latestTag = release.tag_name?.replace(/^v/, '');

      if (!latestTag) return;

      // Compare semantic versions (e.g. 0.1.15 vs 0.1.16)
      if (this.isNewerVersion(currentVersion, latestTag)) {
        const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
        const downloadUrl = apkAsset?.browser_download_url || release.html_url;

        Alert.alert(
          'Update Available',
          `A new version of Orbit Mobile (v${latestTag}) is available. Would you like to update now?`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Download & Install',
              style: 'default',
              onPress: () => {
                Linking.openURL(downloadUrl).catch(() => {});
              },
            },
          ]
        );
      } else if (!silent) {
        Alert.alert('Up to Date', `Orbit Mobile is already on the latest version (v${currentVersion}).`);
      }
    } catch (e) {
      if (!silent) {
        Alert.alert('Check Failed', 'Unable to check for updates. Please check your network connection.');
      }
    }
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const currentParts = current.split('.').map(n => parseInt(n, 10) || 0);
    const latestParts = latest.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const cur = currentParts[i] || 0;
      const lat = latestParts[i] || 0;
      if (lat > cur) return true;
      if (lat < cur) return false;
    }
    return false;
  }
}

export const mobileAppUpdateService = new MobileAppUpdateService();
