import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Users, Check, ChevronRight, Minimize2, Terminal, Image as ImageIcon, Camera, X, Eye, Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';
import { convertFileSrc } from '@tauri-apps/api/core';
import { clsx } from 'clsx';

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number = 16000): Float32Array {
  if (outputRate >= inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : (buffer[offsetBuffer] || 0);
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function normalizeAudioBuffer(samples: Float32Array): Float32Array {
  if (samples.length === 0) return samples;

  // 1. Remove DC bias
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;

  let maxPeak = 0;
  const centered = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const val = samples[i] - mean;
    centered[i] = val;
    const abs = Math.abs(val);
    if (abs > maxPeak) maxPeak = abs;
  }

  // If signal is virtually completely silent (< 0.005), return centered
  if (maxPeak < 0.005) return centered;

  // Normalize so peak speech amplitude is ~0.85 (-1.4 dBFS) for optimal Whisper SNR
  const targetPeak = 0.85;
  const gain = Math.min(12.0, targetPeak / maxPeak);

  for (let i = 0; i < centered.length; i++) {
    const boosted = centered[i] * gain;
    centered[i] = Math.max(-1.0, Math.min(1.0, boosted));
  }

  return centered;
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 1 channel (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Uint8Array(buffer);
}

export const SwarmBroadcastBar: React.FC = () => {
  const { agents, broadcastCommand, sendTerminalCommand } = useAgentStore();
  const { getActiveWorkspace, activeSpaceIdByProject } = useWorkspaceStore();
  const { maximizedAgentId, isBroadcastCollapsed, toggleBroadcastCollapsed } = useUIStore();

  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const isListeningRef = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const basePromptRef = useRef<string>('');
  const handleSendRef = useRef<() => void>(() => {});
  const hasDetectedSpeechRef = useRef<boolean>(false);
  const lastSpeechTimeRef = useRef<number>(0);
  const stopVoiceModeRef = useRef<(autoSend?: boolean) => void>(() => {});

  const activeWorkspace = getActiveWorkspace();
  const activeSpaceId = (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) || activeWorkspace?.spaces?.[0]?.id || `space-${activeWorkspace?.id}-1`;

  const spaceAgents = agents.filter(
    (a) => (a.spaceId || activeWorkspace?.spaces?.[0]?.id || 'default') === activeSpaceId || (!a.spaceId && activeWorkspace?.spaces?.[0]?.id === activeSpaceId)
  );

  // Load preview data URLs for attached images
  useEffect(() => {
    attachedImages.forEach(async (path) => {
      if (!imagePreviews[path]) {
        try {
          const b64 = await tauriService.readImageBase64(path);
          if (b64) {
            setImagePreviews((prev) => ({ ...prev, [path]: b64 }));
            return;
          }
        } catch {}

        try {
          const src = convertFileSrc(path);
          if (src) {
            setImagePreviews((prev) => ({ ...prev, [path]: src }));
          }
        } catch {}
      }
    });
  }, [attachedImages, imagePreviews]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dismiss voice feedback message after 4s
  useEffect(() => {
    if (voiceFeedback && !isListening && !isTranscribing) {
      const timer = setTimeout(() => setVoiceFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [voiceFeedback, isListening, isTranscribing]);

  // Cleanup voice resources on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (scriptProcessorRef.current) {
        try { scriptProcessorRef.current.disconnect(); } catch {}
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
      }
    };
  }, []);

  // Auto-grow textarea height up to 180px ONLY when user writes multi-line prompt/paragraph
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!input) {
      el.style.height = '24px';
      return;
    }
    el.style.height = 'auto';
    const newHeight = Math.min(160, Math.max(24, el.scrollHeight));
    el.style.height = `${newHeight}px`;
  }, [input]);

  // Process clipboard DataTransfer object synchronously and extract image
  const processClipboardData = useCallback(async (clipboardData: DataTransfer): Promise<boolean> => {
    // CRITICAL: Must read items and files synchronously before any async await
    const files = Array.from(clipboardData.files || []);
    const items = Array.from(clipboardData.items || []);

    let imageFile: File | null = null;

    // 1. Check files array
    for (const f of files) {
      if (f.type && f.type.startsWith('image/')) {
        imageFile = f;
        break;
      }
    }

    // 2. Check items array
    if (!imageFile) {
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            imageFile = f;
            break;
          }
        }
      }
    }

    // 3. Save extracted image file (ONLY KEEP LATEST SCREENSHOT)
    if (imageFile) {
      try {
        const buffer = await imageFile.arrayBuffer();
        const ext = imageFile.type.split('/')[1] || 'png';
        const safeName = `screenshot_${Date.now()}.${ext}`;
        const savedPath = await tauriService.saveImageBytes(
          activeWorkspace?.projectPath || '',
          safeName,
          new Uint8Array(buffer)
        );
        if (savedPath) {
          // Replace any older screenshot so only the latest is pasted
          setAttachedImages([savedPath]);
          return true;
        }
      } catch (err) {
        console.error('Failed to save pasted clipboard image:', err);
      }
    }

    // 4. Check if plain text contains an image file path (e.g. /home/user/image.png)
    const text = clipboardData.getData('text')?.trim();
    if (text && /\.(png|jpg|jpeg|webp|gif|svg|bmp)$/i.test(text)) {
      const cleanPath = text.replace(/^file:\/\//, '');
      if (cleanPath.startsWith('/') || cleanPath.startsWith('~') || /^[a-zA-Z]:[\\/]/.test(cleanPath)) {
        setAttachedImages([cleanPath]);
        return true;
      }
    }

    // 5. If no image found in clipboard directly, check for latest screenshot file on OS
    if (isTauriAvailable()) {
      try {
        const latest = await tauriService.getLatestScreenshot(activeWorkspace?.projectPath);
        if (latest) {
          setAttachedImages([latest]);
          return true;
        }
      } catch {}
    }

    return false;
  }, [activeWorkspace?.projectPath]);

  // Global paste handler when broadcast bar is visible so Ctrl+V anywhere in window attaches latest screenshot
  useEffect(() => {
    if (isBroadcastCollapsed || spaceAgents.length === 0 || maximizedAgentId) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is typing inside an open file editor modal, Monaco editor, or other inputs
      const target = e.target as HTMLElement | null;
      if (target && target !== inputRef.current && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        return;
      }

      if (!e.clipboardData) return;

      const handled = await processClipboardData(e.clipboardData);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isBroadcastCollapsed, spaceAgents.length, maximizedAgentId, processClipboardData]);

  const stopVoiceMode = useCallback(async (autoSend: boolean = false) => {
    setIsListening(false);
    isListeningRef.current = false;
    hasDetectedSpeechRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }

    const audioCtx = audioContextRef.current;
    const sampleRate = audioCtx?.sampleRate || 44100;
    if (audioCtx && audioCtx.state !== 'closed') {
      try {
        audioCtx.close();
      } catch {}
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Process collected PCM samples via local Whisper engine
    const pcmChunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const totalSamples = pcmChunks.reduce((sum, c) => sum + c.length, 0);

    // Require at least 0.25s of audio to attempt transcription
    if (totalSamples > sampleRate * 0.25 && isTauriAvailable()) {
      setIsTranscribing(true);
      setVoiceFeedback('Transcribing speech with Whisper base model...');

      try {
        const merged = new Float32Array(totalSamples);
        let offset = 0;
        for (const chunk of pcmChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        // 1. Resample to 16kHz
        const downsampled = downsampleBuffer(merged, sampleRate, 16000);
        // 2. High-fidelity dynamic AGC peak normalization + DC removal
        const normalized = normalizeAudioBuffer(downsampled);
        // 3. Encode to standard 16-bit PCM WAV
        const wavBytes = encodeWAV(normalized, 16000);

        const filename = `voice_input_${Date.now()}.wav`;
        const savedPath = await tauriService.saveImageBytes(
          activeWorkspace?.projectPath || '',
          filename,
          wavBytes
        );

        if (savedPath) {
          const transcript = await tauriService.transcribeAudio(savedPath);
          const clean = (transcript || '').trim();

          if (clean) {
            const isVerbalDispatch = /\b(send|dispatch|execute|run)$/i.test(clean);
            const cleanInstruction = isVerbalDispatch
              ? clean.replace(/\b(send|dispatch|execute|run)$/i, '').trim()
              : clean;

            setInput((prev) => {
              const base = basePromptRef.current ? `${basePromptRef.current.trim()} ` : '';
              if (!cleanInstruction) return prev;
              return `${base}${cleanInstruction}`.trim();
            });

            setVoiceFeedback(`Transcribed: "${cleanInstruction || clean}"`);
            inputRef.current?.focus();

            if (isVerbalDispatch && cleanInstruction) {
              setTimeout(() => {
                handleSendRef.current();
              }, 250);
              setIsTranscribing(false);
              return;
            }
          } else {
            setVoiceFeedback('No speech detected in audio');
          }
        }
      } catch (err: any) {
        console.warn('Whisper transcription error:', err);
        setVoiceFeedback('Transcription error: Whisper failed');
      } finally {
        setIsTranscribing(false);
      }
    }

    if (autoSend) {
      setTimeout(() => {
        handleSendRef.current();
      }, 150);
    }
  }, [activeWorkspace?.projectPath]);

  stopVoiceModeRef.current = stopVoiceMode;

  const startVoiceMode = useCallback(async () => {
    if (isListening) {
      await stopVoiceMode(false);
      return;
    }

    setVoiceFeedback('Listening... Speak your instruction');
    basePromptRef.current = inputRef.current?.value || '';
    hasDetectedSpeechRef.current = false;
    lastSpeechTimeRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;
      setIsListening(true);
      isListeningRef.current = true;
      pcmChunksRef.current = [];

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          let audioCtx: AudioContext;
          try {
            audioCtx = new AudioCtxClass({ sampleRate: 16000 });
          } catch {
            audioCtx = new AudioCtxClass();
          }
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.2;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);

          // ScriptProcessor for raw PCM capture
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = processor;
          processor.onaudioprocess = (e) => {
            if (!isListeningRef.current) return;
            const channel = e.inputBuffer.getChannelData(0);
            pcmChunksRef.current.push(new Float32Array(channel));
          };

          source.connect(analyser);
          analyser.connect(processor);
          processor.connect(audioCtx.destination);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current || !isListeningRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sumSq = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const norm = dataArray[i] / 255;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / dataArray.length);
            const level = Math.min(100, Math.round(rms * 240));
            setAudioLevel(level);

            const now = Date.now();
            if (level > 12) {
              if (!hasDetectedSpeechRef.current) {
                hasDetectedSpeechRef.current = true;
                setVoiceFeedback('Listening... (speaking)');
              }
              lastSpeechTimeRef.current = now;
            } else if (hasDetectedSpeechRef.current && now - lastSpeechTimeRef.current > 1800) {
              // Voice activity detection: speech was detected, followed by 1.8s of silence -> auto transcribe!
              stopVoiceModeRef.current(false);
              return;
            }

            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch (audioErr) {
          console.warn('AudioContext visualization error:', audioErr);
        }
      }

      // Web Speech API fallback for live interim text if supported by browser
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                final += transcript;
              } else {
                interim += transcript;
              }
            }

            const spoken = (final || interim).trim();
            if (spoken) {
              const base = basePromptRef.current ? `${basePromptRef.current.trim()} ` : '';
              setInput(`${base}${spoken}`);
            }
          };

          recognition.onerror = () => {};

          recognition.onend = () => {
            if (mediaStreamRef.current && mediaStreamRef.current.active && isListeningRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to start voice mode:', err);
      setIsListening(false);
      isListeningRef.current = false;
      hasDetectedSpeechRef.current = false;
      setVoiceFeedback(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied by system'
          : 'Could not access microphone hardware'
      );
    }
  }, [isListening, stopVoiceMode]);

  const toggleAgentTarget = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter(id => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  if (spaceAgents.length === 0 || maximizedAgentId) return null;

  const isBroadcastingToAll = selectedAgentIds.length === 0;

  const handleAttachImage = async () => {
    if (isTauriAvailable()) {
      try {
        const selectedPath = await tauriService.openFileDialog('Select Image to Attach');
        if (selectedPath) {
          setAttachedImages((prev) => (prev.includes(selectedPath) ? prev : [...prev, selectedPath]));
          return;
        }
      } catch (err) {
        console.warn('Native openFileDialog failed, falling back to input:', err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleCaptureScreenshot = async () => {
    if (isCapturingScreen) return;
    setIsCapturingScreen(true);

    try {
      // 1. First priority: Check for latest screenshot file taken on OS (GNOME/Ubuntu PrintScreen)
      if (isTauriAvailable()) {
        try {
          const latest = await tauriService.getLatestScreenshot(activeWorkspace?.projectPath);
          if (latest) {
            setAttachedImages([latest]); // ONLY KEEP LATEST SCREENSHOT
            setIsCapturingScreen(false);
            return;
          }
        } catch {}
      }

      // 2. Check navigator.clipboard.read() for image
      if (navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              const buffer = await blob.arrayBuffer();
              const ext = imageType.split('/')[1] || 'png';
              const safeName = `screenshot_${Date.now()}.${ext}`;
              const savedPath = await tauriService.saveImageBytes(
                activeWorkspace?.projectPath || '',
                safeName,
                new Uint8Array(buffer)
              );
              if (savedPath) {
                setAttachedImages([savedPath]); // ONLY KEEP LATEST SCREENSHOT
                setIsCapturingScreen(false);
                return;
              }
            }
          }
        } catch {}
      }

      // 3. Check native Tauri clipboard image
      if (isTauriAvailable()) {
        try {
          const savedPath = await tauriService.readClipboardImage(activeWorkspace?.projectPath || '');
          if (savedPath) {
            setAttachedImages([savedPath]); // ONLY KEEP LATEST SCREENSHOT
            setIsCapturingScreen(false);
            return;
          }
        } catch {}
      }

      // 4. Interactive live screen / window capture via getDisplayMedia
      if (navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: false,
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(reject);
          };
          setTimeout(resolve, 600);
        });

        await new Promise((r) => setTimeout(r, 120));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        stream.getTracks().forEach((t) => t.stop());

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );

        if (blob) {
          const buffer = await blob.arrayBuffer();
          const safeName = `screenshot_${Date.now()}.png`;
          const savedPath = await tauriService.saveImageBytes(
            activeWorkspace?.projectPath || '',
            safeName,
            new Uint8Array(buffer)
          );
          if (savedPath) {
            setAttachedImages([savedPath]); // ONLY KEEP LATEST SCREENSHOT
            setIsCapturingScreen(false);
            return;
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        console.warn('Live screen capture error:', err);
      }
    } finally {
      setIsCapturingScreen(false);
    }

    // 5. Fallback: prompt file picker
    await handleAttachImage();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nativePath = (file as any).path;
      if (nativePath && typeof nativePath === 'string') {
        newPaths.push(nativePath);
      } else {
        try {
          const buffer = await file.arrayBuffer();
          const safeName = `img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const savedPath = await tauriService.saveImageBytes(
            activeWorkspace?.projectPath || '',
            safeName,
            new Uint8Array(buffer)
          );
          if (savedPath) newPaths.push(savedPath);
        } catch (err) {
          console.error('Failed to save image attachment:', err);
        }
      }
    }

    if (newPaths.length > 0) {
      setAttachedImages((prev) => [...prev, ...newPaths.filter((p) => !prev.includes(p))]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const handled = await processClipboardData(clipboardData);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Fallback: If not handled by browser event, check native Tauri clipboard image or latest screenshot
    if (isTauriAvailable()) {
      try {
        const savedPath = await tauriService.readClipboardImage(activeWorkspace?.projectPath || '');
        if (savedPath) {
          e.preventDefault();
          e.stopPropagation();
          setAttachedImages([savedPath]);
          return;
        }

        const latest = await tauriService.getLatestScreenshot(activeWorkspace?.projectPath);
        if (latest) {
          e.preventDefault();
          e.stopPropagation();
          setAttachedImages([latest]);
        }
      } catch {}
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const nativePath = (file as any).path;
      if (nativePath && typeof nativePath === 'string') {
        newPaths.push(nativePath);
      } else {
        try {
          const buffer = await file.arrayBuffer();
          const safeName = `dropped_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const savedPath = await tauriService.saveImageBytes(
            activeWorkspace?.projectPath || '',
            safeName,
            new Uint8Array(buffer)
          );
          if (savedPath) newPaths.push(savedPath);
        } catch (err) {
          console.error('Failed to save dropped image:', err);
        }
      }
    }

    if (newPaths.length > 0) {
      setAttachedImages([newPaths[newPaths.length - 1]]); // ONLY KEEP LATEST
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setAttachedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const resolveAgentTarget = (rawText: string) => {
    const trimmed = rawText.trim();
    // 1. Explicit @agent syntax
    const atMatch = trimmed.match(/^@([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (atMatch) {
      const targetHandle = atMatch[1].toLowerCase();
      const subPrompt = (atMatch[2] || '').trim();
      const matched = spaceAgents.find(
        (a) =>
          a.name.toLowerCase().includes(targetHandle) ||
          a.provider.toLowerCase().includes(targetHandle) ||
          (a.profileId && a.profileId.toLowerCase() === targetHandle)
      );
      return { matchedAgent: matched, prompt: subPrompt, isTargeted: true };
    }

    // 2. Conversational prefix: e.g. "hey claude, fix build" or "claude: run test" or "tell claude to inspect"
    const convMatch = trimmed.match(/^(?:hey\s+|tell\s+|ask\s+)?([a-zA-Z0-9_-]+)(?:,\s*|:\s*|\s+to\s+)(.*)$/i);
    if (convMatch) {
      const targetHandle = convMatch[1].toLowerCase();
      const subPrompt = (convMatch[2] || '').trim();
      const matched = spaceAgents.find(
        (a) =>
          a.name.toLowerCase() === targetHandle ||
          a.provider.toLowerCase() === targetHandle ||
          (a.profileId && a.profileId.toLowerCase() === targetHandle) ||
          a.name.toLowerCase().includes(targetHandle)
      );
      if (matched) {
        return { matchedAgent: matched, prompt: subPrompt, isTargeted: true };
      }
    }

    return { matchedAgent: undefined, prompt: trimmed, isTargeted: false };
  };

  const handleThrowToAgent = async (targetImagePath?: string) => {
    if (isListening) {
      stopVoiceMode(false);
    }

    const imagesToThrow = targetImagePath ? [targetImagePath] : attachedImages;
    if (imagesToThrow.length === 0 || isExecuting) return;

    setIsExecuting(true);
    try {
      const trimmed = input.trim();
      const defaultPrompt = 'Please inspect this screenshot:';
      const { matchedAgent, prompt, isTargeted } = resolveAgentTarget(trimmed);

      const instruction = prompt || defaultPrompt;
      const promptWithImages = `${instruction} ${imagesToThrow.join(' ')}`;

      if (isTargeted && matchedAgent) {
        await sendTerminalCommand(
          matchedAgent.id,
          `${promptWithImages}\r`,
          activeWorkspace?.projectPath,
          activeWorkspace?.id
        );
      } else {
        if (selectedAgentIds.length === 1) {
          await sendTerminalCommand(
            selectedAgentIds[0],
            `${promptWithImages}\r`,
            activeWorkspace?.projectPath,
            activeWorkspace?.id
          );
        } else {
          await broadcastCommand(
            promptWithImages,
            selectedAgentIds.length > 0 ? selectedAgentIds : spaceAgents.map((a) => a.id),
            activeWorkspace?.projectPath,
            activeWorkspace?.id
          );
        }
      }

      setInput('');
      setAttachedImages((prev) => prev.filter((p) => !imagesToThrow.includes(p)));
      setPreviewModalImage(null);
    } catch (e) {
      console.error('Throw screenshot to agent error:', e);
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = async () => {
    if (isListening) {
      stopVoiceMode(false);
    }

    const trimmed = input.trim();
    const hasImages = attachedImages.length > 0;
    if ((!trimmed && !hasImages) || isExecuting) return;

    setIsExecuting(true);
    try {
      const { matchedAgent, prompt, isTargeted } = resolveAgentTarget(trimmed);

      if (isTargeted && matchedAgent) {
        const promptWithImages = [prompt, ...attachedImages].filter(Boolean).join(' ');
        await sendTerminalCommand(
          matchedAgent.id,
          `${promptWithImages}\r`,
          activeWorkspace?.projectPath,
          activeWorkspace?.id
        );
      } else {
        const promptWithImages = [prompt || trimmed, ...attachedImages].filter(Boolean).join(' ');

        if (selectedAgentIds.length === 1) {
          await sendTerminalCommand(
            selectedAgentIds[0],
            `${promptWithImages}\r`,
            activeWorkspace?.projectPath,
            activeWorkspace?.id
          );
        } else {
          await broadcastCommand(
            promptWithImages,
            selectedAgentIds.length > 0 ? selectedAgentIds : spaceAgents.map((a) => a.id),
            activeWorkspace?.projectPath,
            activeWorkspace?.id
          );
        }
      }

      setInput('');
      setAttachedImages([]);
    } catch (e) {
      console.error('Broadcast execution error:', e);
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isListening) {
        stopVoiceMode(false);
      }
      handleSend();
      return;
    }

    // Explicit fallback for Ctrl+V / Cmd+V when browser paste event is blocked or swallowed
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      // 1. Try reading latest screenshot from OS (GNOME/Ubuntu PrintScreen)
      if (isTauriAvailable()) {
        tauriService.getLatestScreenshot(activeWorkspace?.projectPath).then((latest) => {
          if (latest) {
            setAttachedImages([latest]); // ONLY KEEP LATEST SCREENSHOT
          }
        }).catch(() => {});
      }

      // 2. Try reading clipboard image via navigator.clipboard.read()
      if (navigator.clipboard?.read) {
        navigator.clipboard.read().then(async (clipItems) => {
          for (const item of clipItems) {
            const imgType = item.types.find((t) => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              const buffer = await blob.arrayBuffer();
              const ext = imgType.split('/')[1] || 'png';
              const safeName = `screenshot_${Date.now()}.${ext}`;
              const savedPath = await tauriService.saveImageBytes(
                activeWorkspace?.projectPath || '',
                safeName,
                new Uint8Array(buffer)
              );
              if (savedPath) {
                setAttachedImages([savedPath]); // ONLY KEEP LATEST SCREENSHOT
                return;
              }
            }
          }
        }).catch(() => {});
      }

      // 3. Check native Tauri clipboard image or text
      if (isTauriAvailable()) {
        const valBefore = inputRef.current?.value || '';
        setTimeout(async () => {
          try {
            const imgPath = await tauriService.readClipboardImage(activeWorkspace?.projectPath || '');
            if (imgPath) {
              setAttachedImages([imgPath]); // ONLY KEEP LATEST SCREENSHOT
              return;
            }

            if (inputRef.current && inputRef.current.value === valBefore) {
              const text = await tauriService.readClipboardText();
              if (text) {
                const el = inputRef.current;
                const start = el.selectionStart ?? el.value.length;
                const end = el.selectionEnd ?? el.value.length;
                const newVal = el.value.substring(0, start) + text + el.value.substring(end);
                setInput(newVal);
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.selectionStart = inputRef.current.selectionEnd = start + text.length;
                  }
                }, 0);
              }
            }
          } catch {}
        }, 30);
      }
    }
  };

  const getTargetSummary = () => {
    if (isBroadcastingToAll) return `All (${spaceAgents.length})`;
    if (selectedAgentIds.length === 1) {
      const single = spaceAgents.find(a => a.id === selectedAgentIds[0]);
      return single ? `@${single.name.toLowerCase()}` : '1 Agent';
    }
    return `${selectedAgentIds.length} Agents`;
  };

  // Collapsed View (Ultra-Minimal Floating Launcher Pill)
  if (isBroadcastCollapsed) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 select-none no-drag pointer-events-auto">
        <button
          onClick={toggleBroadcastCollapsed}
          className="h-8 px-3 rounded-full bg-panel-elevated/90 hover:bg-panel-elevated backdrop-blur-2xl border border-border hover:border-border-hover text-text-secondary hover:text-text-primary text-xs font-mono font-medium flex items-center gap-2 shadow-lg transition-all cursor-pointer group active:scale-95"
          title="Open Swarm Broadcast Bar (Ctrl+K)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Broadcast ({spaceAgents.length})</span>
          <Terminal size={11} className="text-text-muted group-hover:text-text-primary transition-colors" />
        </button>
      </div>
    );
  }

  // Expanded View (Full Monolithic Pill)
  return (
    <div 
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 select-none no-drag pointer-events-auto"
      onPaste={handlePaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      
      {/* Target Popover Menu */}
      {isDropdownOpen && (
        <div 
          ref={dropdownRef}
          className="absolute bottom-full left-4 mb-2 w-64 p-1.5 bg-panel-elevated/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-dim font-bold">
            Target Agents
          </div>

          <button
            onClick={() => {
              setSelectedAgentIds([]);
              setIsDropdownOpen(false);
            }}
            className={clsx(
              "flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer text-left",
              isBroadcastingToAll ? "bg-text-primary text-background font-bold" : "text-text-secondary hover:bg-well hover:text-text-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <Users size={12} className="text-text-muted" />
              <span>All Active Agents</span>
            </div>
            {isBroadcastingToAll && <Check size={12} strokeWidth={3} className="text-emerald-500" />}
          </button>

          {spaceAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgentTarget(agent.id)}
                className={clsx(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer text-left",
                  isSelected ? "bg-text-primary text-background font-bold" : "text-text-secondary hover:bg-well hover:text-text-primary"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">@{agent.name.toLowerCase()}</span>
                  {agent.profileId && agent.profileId !== 'default' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-bold uppercase">
                      {agent.profileId}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={12} strokeWidth={3} className="text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Attached Images Preview Tray */}
      {attachedImages.length > 0 && (
        <div className="mb-2 p-1.5 px-2.5 bg-panel-elevated/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150 max-h-36 overflow-y-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim font-bold flex items-center gap-1.5 pl-1 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Latest Screenshot:</span>
          </div>

          {attachedImages.map((filePath, idx) => {
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
            const previewUrl = imagePreviews[filePath];

            return (
              <div
                key={`${filePath}-${idx}`}
                className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-xl bg-well border border-border text-[11px] font-mono text-text-secondary group shadow-sm hover:border-emerald-500/40 transition-all max-w-[320px]"
                title={filePath}
              >
                {/* Visual Thumbnail */}
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(filePath)}
                  className="w-7 h-7 rounded-lg overflow-hidden bg-black/40 border border-border shrink-0 hover:opacity-80 transition-opacity cursor-pointer relative group/thumb"
                  title="Click to preview screenshot"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-dim">
                      <ImageIcon size={12} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye size={10} />
                  </div>
                </button>

                {/* Filename & Path */}
                <span
                  onClick={() => setPreviewModalImage(filePath)}
                  className="truncate cursor-pointer hover:text-text-primary transition-colors select-none max-w-[130px]"
                >
                  {fileName}
                </span>

                {/* Throw to Agent Quick Action */}
                <button
                  type="button"
                  onClick={() => handleThrowToAgent(filePath)}
                  disabled={isExecuting}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-[10px] font-mono font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                  title="Throw screenshot to agent immediately"
                >
                  <Send size={10} />
                  <span>Throw</span>
                </button>

                {/* Remove Image */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="text-text-dim hover:text-red-400 p-0.5 rounded-md transition-colors cursor-pointer shrink-0"
                  title="Remove screenshot"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input for image attachment fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Voice Mode Status / Notification Pill */}
      {voiceFeedback && (
        <div className="mb-2 px-3 py-1 bg-panel-elevated/95 backdrop-blur-2xl border border-border rounded-full text-[11px] font-mono text-text-primary flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 select-none">
          <div className="flex items-center gap-2">
            <span className={clsx("w-1.5 h-1.5 rounded-full", isTranscribing ? "bg-amber-400 animate-ping" : isListening ? "bg-red-500 animate-pulse" : "bg-emerald-400")} />
            <span>{voiceFeedback}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setVoiceFeedback(null)} 
            className="text-text-dim hover:text-text-primary p-0.5 cursor-pointer ml-2"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Floating Monolithic Command Pill with Dynamic Theme Tokens */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className={clsx(
          "w-full pl-1.5 pr-2 py-1 bg-panel-elevated/90 hover:bg-panel-elevated backdrop-blur-2xl border flex gap-1.5 shadow-2xl transition-all duration-200 cursor-text",
          input && (input.includes('\n') || input.length > 55)
            ? "min-h-[56px] max-h-[220px] rounded-2xl items-end"
            : "h-10 rounded-full items-center",
          isFocused 
            ? "border-border-hover ring-2 ring-border-hover/20 shadow-lg" 
            : "border-border hover:border-border-hover shadow-md"
        )}
      >
        
        {/* Target Badge / Selector */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-well hover:bg-panel border border-border text-text-primary text-[11px] font-mono font-medium transition-all cursor-pointer shrink-0 active:scale-95",
            input && (input.includes('\n') || input.length > 55) && "mb-0.5"
          )}
          title="Select target agents (or type @agent)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate max-w-[100px]">{getTargetSummary()}</span>
        </button>

        {/* Screenshot / Screen Capture Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCaptureScreenshot();
          }}
          disabled={isCapturingScreen}
          className={clsx(
            "p-1.5 rounded-full transition-all cursor-pointer shrink-0 flex items-center justify-center",
            input && (input.includes('\n') || input.length > 55) && "mb-0.5",
            isCapturingScreen
              ? "text-amber-400 bg-amber-500/15 animate-pulse"
              : attachedImages.length > 0
                ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30"
                : "text-text-dim hover:text-text-secondary hover:bg-well active:scale-90"
          )}
          title="Attach latest screenshot (or press Ctrl+V to paste)"
        >
          <Camera size={14} />
        </button>

        {/* Attach Image File Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAttachImage();
          }}
          className={clsx(
            "p-1.5 rounded-full transition-all cursor-pointer shrink-0 flex items-center justify-center",
            input && (input.includes('\n') || input.length > 55) && "mb-0.5",
            attachedImages.length > 0
              ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30"
              : "text-text-dim hover:text-text-secondary hover:bg-well active:scale-90"
          )}
          title="Browse & attach image file"
        >
          <ImageIcon size={14} />
        </button>

        {/* Voice Mode Mic Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isListening) {
              stopVoiceMode(false);
            } else {
              startVoiceMode();
            }
          }}
          disabled={isTranscribing}
          className={clsx(
            "p-1.5 rounded-full transition-all cursor-pointer shrink-0 flex items-center justify-center relative",
            input && (input.includes('\n') || input.length > 55) && "mb-0.5",
            isTranscribing
              ? "text-amber-400 bg-amber-500/20 ring-1 ring-amber-500/40 cursor-wait"
              : isListening
                ? "text-red-400 bg-red-500/20 ring-2 ring-red-500/40 animate-pulse shadow-sm shadow-red-500/20"
                : "text-text-dim hover:text-text-secondary hover:bg-well active:scale-90"
          )}
          title={
            isTranscribing
              ? "Transcribing voice with Whisper..."
              : isListening
                ? "Stop voice listening (or say 'send')"
                : "Voice mode: Talk and instruct agents"
          }
        >
          {isTranscribing ? (
            <Loader2 size={14} className="animate-spin text-amber-400" />
          ) : isListening ? (
            <Mic size={14} className="text-red-400 animate-pulse" />
          ) : (
            <Mic size={14} />
          )}
          {isListening && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>

        {/* Live Audio Visualizer Equalizer Wavebars when listening */}
        {isListening && (
          <div 
            className={clsx(
              "flex items-center gap-0.5 px-1 h-7 select-none shrink-0",
              input && (input.includes('\n') || input.length > 55) && "mb-0.5"
            )}
            title="Listening to your voice... (stops automatically after speaking)"
          >
            <span 
              className={clsx("w-0.5 rounded-full transition-all duration-75", audioLevel > 12 ? "bg-emerald-400" : "bg-red-400")}
              style={{ height: `${Math.max(3, Math.min(16, (audioLevel * 0.16) + 3))}px` }}
            />
            <span 
              className={clsx("w-0.5 rounded-full transition-all duration-75", audioLevel > 12 ? "bg-emerald-500" : "bg-red-500")}
              style={{ height: `${Math.max(4, Math.min(18, (audioLevel * 0.22) + 4))}px` }}
            />
            <span 
              className={clsx("w-0.5 rounded-full transition-all duration-75", audioLevel > 12 ? "bg-emerald-400" : "bg-rose-400")}
              style={{ height: `${Math.max(5, Math.min(20, (audioLevel * 0.26) + 5))}px` }}
            />
            <span 
              className={clsx("w-0.5 rounded-full transition-all duration-75", audioLevel > 12 ? "bg-emerald-500" : "bg-red-500")}
              style={{ height: `${Math.max(4, Math.min(18, (audioLevel * 0.20) + 4))}px` }}
            />
            <span 
              className={clsx("w-0.5 rounded-full transition-all duration-75", audioLevel > 12 ? "bg-emerald-400" : "bg-red-400")}
              style={{ height: `${Math.max(3, Math.min(15, (audioLevel * 0.15) + 3))}px` }}
            />
          </div>
        )}

        {/* Auto-growing Multi-line Command Input */}
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isTranscribing
              ? "⏳ Transcribing speech to text..."
              : isListening
                ? "🎙️ Listening... speak instruction..."
                : attachedImages.length > 0
                  ? "Add instruction or press Enter..."
                  : "Broadcast instruction or @agent..."
          }
          className={clsx(
            "flex-1 bg-transparent border-none outline-none font-mono text-xs text-text-primary placeholder:text-text-dim placeholder:truncate selection:bg-border min-w-0 resize-none py-1 leading-normal max-h-[160px]",
            input ? "overflow-y-auto" : "overflow-hidden h-6 leading-6"
          )}
        />

        {/* Right Actions: Throw Button + Minimize Pill + Send Button */}
        <div 
          className={clsx(
            "flex items-center gap-1 shrink-0",
            input && (input.includes('\n') || input.length > 55) && "mb-0.5"
          )} 
          onClick={(e) => e.stopPropagation()}
        >
          {attachedImages.length > 0 && (
            <button
              type="button"
              onClick={() => handleThrowToAgent()}
              disabled={isExecuting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              title="Throw latest screenshot to agent immediately"
            >
              <Send size={11} strokeWidth={2.5} />
              <span>Throw</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleBroadcastCollapsed}
            className="p-1 rounded-full text-text-dim hover:text-text-muted transition-colors cursor-pointer"
            title="Minimize Broadcast Bar"
          >
            <Minimize2 size={11} />
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={(!input.trim() && attachedImages.length === 0) || isExecuting}
            className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer",
              (input.trim() || attachedImages.length > 0) && !isExecuting
                ? "bg-text-primary text-background hover:opacity-90 shadow-sm active:scale-90"
                : "text-text-dim hover:text-text-muted cursor-not-allowed opacity-50"
            )}
            title="Dispatch (Enter)"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>

      </div>

      {/* Screenshot Preview Modal / Lightbox */}
      {previewModalImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setPreviewModalImage(null)}
        >
          <div 
            className="bg-panel-elevated border border-border rounded-2xl shadow-2xl max-w-2xl w-full p-4 flex flex-col gap-3.5 overflow-hidden animate-in zoom-in-95 duration-150 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2 truncate">
                <Camera size={15} className="text-emerald-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-text-primary truncate max-w-md">
                  {previewModalImage.split('/').pop() || previewModalImage}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1 rounded-lg text-text-dim hover:text-text-primary hover:bg-well transition-colors cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Image Viewport */}
            <div className="relative rounded-xl overflow-hidden bg-black/60 border border-border/80 flex items-center justify-center max-h-[55vh] min-h-[160px]">
              {imagePreviews[previewModalImage] ? (
                <img 
                  src={imagePreviews[previewModalImage]} 
                  alt="Screenshot Preview" 
                  className="max-h-[55vh] w-auto object-contain select-none"
                />
              ) : (
                <div className="py-20 text-xs font-mono text-text-muted flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Loading screenshot preview...</span>
                </div>
              )}
            </div>

            {/* Path info */}
            <div className="text-[11px] font-mono text-text-dim truncate px-1" title={previewModalImage}>
              File: {previewModalImage}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  setAttachedImages((prev) => prev.filter((p) => p !== previewModalImage));
                  setPreviewModalImage(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-border hover:border-red-500/40 text-text-dim hover:text-red-400 text-xs font-mono transition-colors cursor-pointer"
              >
                Delete / Remove
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="px-3 py-1.5 rounded-xl bg-well hover:bg-panel border border-border text-text-secondary hover:text-text-primary text-xs font-mono transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleThrowToAgent(previewModalImage)}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Send size={12} strokeWidth={2.5} />
                  <span>Throw to {getTargetSummary()}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
