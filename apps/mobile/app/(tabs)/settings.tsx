import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Platform, Modal, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { secureStorage } from '../../src/services/secureStorage';
import { mobileRelayService } from '../../src/services/mobileRelay.service';
import { QrCode, Wifi, LogOut, Laptop, Check, Key, X, Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function DeviceSyncScreen() {
  const router = useRouter();
  const [manualPayload, setManualPayload] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isDesktopConnected, setIsDesktopConnected] = useState(mobileRelayService.latestState.isDesktopOnline);

  useEffect(() => {
    mobileRelayService.connect();
    const unsubscribe = mobileRelayService.subscribe(() => {
      setIsDesktopConnected(mobileRelayService.latestState.isDesktopOnline);
    });
    return unsubscribe;
  }, []);

  const handleApplyPairing = async (rawPayload: string) => {
    if (!rawPayload || isPairing) return;
    try {
      setIsPairing(true);
      let token = '';

      const trimmed = rawPayload.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          token = parsed.token || parsed.accessToken || '';
        } catch {}
      } else {
        token = trimmed;
      }

      if (token) {
        await secureStorage.setAccessToken(token);
        await mobileRelayService.connect();
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setPairingSuccess(true);
        setIsScannerOpen(false);
        setManualPayload('');
        setTimeout(() => {
          setPairingSuccess(false);
          router.replace('/(tabs)');
        }, 800);
      } else {
        throw new Error('No valid token found in scanned QR');
      }
    } catch (e) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Pairing Error', 'Invalid QR code. Please ensure you are scanning the QR code from Orbit Desktop.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access to scan your desktop QR code.');
        return;
      }
    }
    setIsScannerOpen(true);
  };

  return (
    <ScrollView className="flex-1 bg-[#090A0F] px-4 pt-12" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View className="mb-6">
        <Text className="text-white font-mono font-bold text-lg">DEVICE SYNC</Text>
        <Text className="text-zinc-400 font-mono text-xs">Pair your mobile cockpit with your desktop workstation</Text>
      </View>

      {/* Live Workstation Connection Card */}
      <LinearGradient
        colors={['#161822', '#0E1017']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4.5 border border-white/[0.08] rounded-3xl mb-4"
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View className={`w-7 h-7 rounded-xl ${isDesktopConnected ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-zinc-800 border-zinc-700'} border flex items-center justify-center`}>
              <Wifi size={14} color={isDesktopConnected ? '#10B981' : '#71717A'} />
            </View>
            <Text className="text-white font-mono font-bold text-xs">WORKSTATION LINK</Text>
          </View>
          <View className={`px-2.5 py-0.5 rounded-full ${isDesktopConnected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800 border-zinc-700'} border`}>
            <Text className={`font-mono text-[10px] font-bold uppercase ${isDesktopConnected ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {isDesktopConnected ? 'Connected' : 'Waiting for Desktop'}
            </Text>
          </View>
        </View>

        <Text className="text-zinc-400 font-mono text-xs leading-relaxed mb-3.5">
          {isDesktopConnected
            ? 'Your laptop is connected and streaming live terminal progress directly to your phone.'
            : 'Open Orbit on your computer to automatically establish the local connection.'}
        </Text>

        <View className="p-3 bg-black/40 border border-white/[0.06] rounded-2xl flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Laptop size={14} color="#A1A1AA" />
            <Text className="text-zinc-300 font-mono text-xs font-semibold">
              Host Workstation ({Platform.OS === 'android' ? 'Linux / PC' : 'Dev Laptop'})
            </Text>
          </View>
          <Text className="text-zinc-500 font-mono text-[11px]">
            {isDesktopConnected ? 'Live' : 'Standby'}
          </Text>
        </View>
      </LinearGradient>

      {/* QR Code Workstation Pairing Card */}
      <LinearGradient
        colors={['#161822', '#0E1017']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4.5 border border-white/[0.08] rounded-3xl mb-4"
      >
        <View className="flex-row items-center gap-2 mb-2">
          <QrCode size={16} color="#FFFFFF" />
          <Text className="text-white font-mono font-bold text-xs uppercase tracking-wider">
            Pair with Desktop
          </Text>
        </View>

        <Text className="text-zinc-400 font-mono text-xs leading-relaxed mb-4">
          Click the <Text className="text-white font-bold">📱 Mobile icon</Text> in your Orbit Desktop header to display the QR Code.
        </Text>

        {pairingSuccess ? (
          <View className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex-row items-center justify-center gap-2 mb-2">
            <Check size={16} color="#10B981" />
            <Text className="text-emerald-400 font-mono text-xs font-bold">
              Paired Successfully! Syncing Workspaces...
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-3">
            {/* Primary Action: 1-Tap Camera QR Scanner */}
            <Pressable
              onPress={handleOpenScanner}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 flex-row items-center justify-center gap-2 active:opacity-85 shadow-md"
            >
              <Camera size={16} color="#000000" />
              <Text className="text-black font-mono font-bold text-xs">
                Scan Desktop QR Code
              </Text>
            </Pressable>

            {/* Fallback Action: Manual Paste */}
            <View className="flex-col gap-2 pt-2 border-t border-white/[0.06]">
              <Text className="text-zinc-500 font-mono text-[10.5px]">
                Or paste pairing token manually:
              </Text>
              <TextInput
                value={manualPayload}
                onChangeText={setManualPayload}
                placeholder="Paste pairing code here..."
                placeholderTextColor="#52525B"
                className="p-3 bg-black/50 border border-white/10 rounded-2xl font-mono text-xs text-white"
              />

              {manualPayload.trim().length > 0 && (
                <Pressable
                  onPress={() => handleApplyPairing(manualPayload)}
                  disabled={isPairing}
                  className="w-full py-3 rounded-2xl bg-white/[0.08] border border-white/10 flex-row items-center justify-center gap-2 active:opacity-90"
                >
                  <Key size={14} color="#FFFFFF" />
                  <Text className="text-white font-mono font-bold text-xs">
                    {isPairing ? 'Linking...' : 'Apply Token'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Disconnect Action */}
      <Pressable
        onPress={async () => {
          await secureStorage.clearTokens();
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {}
          router.replace('/(tabs)');
        }}
        className="w-full py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex-row items-center justify-center gap-2 active:opacity-75"
      >
        <LogOut size={13} color="#EF4444" />
        <Text className="text-red-400 font-mono font-bold text-xs">Disconnect & Unlink</Text>
      </Pressable>

      {/* Native Camera QR Scanner Modal */}
      <Modal
        visible={isScannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsScannerOpen(false)}
      >
        <View className="flex-1 bg-black">
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={({ data }) => {
              if (data && !isPairing) {
                handleApplyPairing(data);
              }
            }}
          />

          {/* Scanner Overlay UI */}
          <View className="flex-1 justify-between p-6 pt-16 bg-black/40">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-white font-mono font-bold text-base">SCAN DESKTOP QR</Text>
                <Text className="text-zinc-300 font-mono text-xs">Point camera at the QR on your laptop</Text>
              </View>
              <Pressable
                onPress={() => setIsScannerOpen(false)}
                className="w-9 h-9 rounded-full bg-white/20 items-center justify-center active:opacity-75"
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Viewfinder Target Box */}
            <View className="self-center w-64 h-64 border-2 border-emerald-400 rounded-3xl bg-transparent relative justify-center items-center">
              <View className="w-12 h-12 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl absolute top-0 left-0" />
              <View className="w-12 h-12 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl absolute top-0 right-0" />
              <View className="w-12 h-12 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl absolute bottom-0 left-0" />
              <View className="w-12 h-12 border-b-4 border-r-4 border-emerald-400 rounded-br-xl absolute bottom-0 right-0" />
              <Text className="text-emerald-300 font-mono text-[11px] font-bold bg-black/60 px-3 py-1 rounded-full">
                Align QR Code Here
              </Text>
            </View>

            <View className="items-center mb-8">
              <Pressable
                onPress={() => setIsScannerOpen(false)}
                className="px-5 py-2.5 rounded-full bg-white/20 active:opacity-85"
              >
                <Text className="text-white font-mono font-bold text-xs">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
