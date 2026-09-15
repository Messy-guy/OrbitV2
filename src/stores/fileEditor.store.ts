import { create } from 'zustand';
import { tauriService } from '../services/tauri.service';
import { useWorkspaceStore } from './workspace.store';

export interface OpenFileItem {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isLoading: boolean;
  mode: 'preview' | 'edit'; // for markdown files (.md)
  language: string;
}

interface FileEditorStore {
  isOpen: boolean;
  isMaximized: boolean;
  activeFilePath: string | null;
  openFiles: Record<string, OpenFileItem>;
  isSaving: boolean;
  error: string | null;

  openFile: (path: string, projectPath?: string, initialMode?: 'preview' | 'edit') => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path?: string) => Promise<boolean>;
  toggleMode: (path?: string) => void;
  setIsOpen: (isOpen: boolean) => void;
  setIsMaximized: (isMaximized: boolean) => void;
  toggleMaximize: () => void;
  openInExternalEditor: (path?: string) => Promise<void>;
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

export const useFileEditorStore = create<FileEditorStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  activeFilePath: null,
  openFiles: {},
  isSaving: false,
  error: null,

  setIsOpen: (isOpen) => set({ isOpen }),
  setIsMaximized: (isMaximized) => set({ isMaximized }),
  toggleMaximize: () => set((state) => ({ isMaximized: !state.isMaximized })),

  openFile: async (path: string, projectPath?: string, initialMode?: 'preview' | 'edit') => {
    const cleanPath = path.trim().replace(/^file:\/\//, '');
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    const activeProjPath = projectPath || ws?.projectPath || '';
    const name = cleanPath.split('/').pop() || cleanPath;
    const isMarkdown = cleanPath.toLowerCase().endsWith('.md') || cleanPath.toLowerCase().endsWith('.markdown');
    const defaultMode = initialMode || (isMarkdown ? 'preview' : 'edit');
    const language = detectLanguage(cleanPath);

    // If file is already open, just switch active tab
    const existing = get().openFiles[cleanPath];
    if (existing) {
      set({
        isOpen: true,
        activeFilePath: cleanPath,
        error: null,
      });
      return;
    }

    // Set initial loading state
    set((state) => ({
      isOpen: true,
      activeFilePath: cleanPath,
      error: null,
      openFiles: {
        ...state.openFiles,
        [cleanPath]: {
          path: cleanPath,
          name,
          content: '',
          originalContent: '',
          isDirty: false,
          isLoading: true,
          mode: defaultMode,
          language,
        },
      },
    }));

    try {
      const content = await tauriService.readWorkspaceFile(activeProjPath, cleanPath);
      set((state) => {
        const file = state.openFiles[cleanPath];
        if (!file) return state;
        return {
          openFiles: {
            ...state.openFiles,
            [cleanPath]: {
              ...file,
              content,
              originalContent: content,
              isLoading: false,
              isDirty: false,
            },
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set((state) => {
        const file = state.openFiles[cleanPath];
        if (!file) return { error: msg };
        return {
          error: msg,
          openFiles: {
            ...state.openFiles,
            [cleanPath]: {
              ...file,
              content: `# Error reading file\n\n\`${cleanPath}\`\n\n${msg}`,
              originalContent: '',
              isLoading: false,
            },
          },
        };
      });
    }
  },

  closeFile: (path: string) => {
    set((state) => {
      const newOpenFiles = { ...state.openFiles };
      delete newOpenFiles[path];
      const remainingPaths = Object.keys(newOpenFiles);
      const nextActive = state.activeFilePath === path
        ? (remainingPaths.length > 0 ? remainingPaths[remainingPaths.length - 1] : null)
        : state.activeFilePath;

      return {
        openFiles: newOpenFiles,
        activeFilePath: nextActive,
        isOpen: remainingPaths.length > 0,
      };
    });
  },

  setActiveFile: (path: string) => {
    if (get().openFiles[path]) {
      set({ activeFilePath: path });
    }
  },

  updateContent: (path: string, content: string) => {
    set((state) => {
      const file = state.openFiles[path];
      if (!file) return state;
      const isDirty = content !== file.originalContent;
      return {
        openFiles: {
          ...state.openFiles,
          [path]: {
            ...file,
            content,
            isDirty,
          },
        },
      };
    });
  },

  saveFile: async (path?: string) => {
    const targetPath = path || get().activeFilePath;
    if (!targetPath) return false;
    const file = get().openFiles[targetPath];
    if (!file) return false;

    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    const activeProjPath = ws?.projectPath || '';

    set({ isSaving: true, error: null });
    try {
      await tauriService.writeWorkspaceFile(activeProjPath, targetPath, file.content);
      set((state) => {
        const currentFile = state.openFiles[targetPath];
        if (!currentFile) return { isSaving: false };
        return {
          isSaving: false,
          openFiles: {
            ...state.openFiles,
            [targetPath]: {
              ...currentFile,
              originalContent: file.content,
              isDirty: false,
            },
          },
        };
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSaving: false, error: msg });
      return false;
    }
  },

  toggleMode: (path?: string) => {
    const targetPath = path || get().activeFilePath;
    if (!targetPath) return;
    set((state) => {
      const file = state.openFiles[targetPath];
      if (!file) return state;
      return {
        openFiles: {
          ...state.openFiles,
          [targetPath]: {
            ...file,
            mode: file.mode === 'preview' ? 'edit' : 'preview',
          },
        },
      };
    });
  },

  openInExternalEditor: async (path?: string) => {
    const targetPath = path || get().activeFilePath || undefined;
    const ws = useWorkspaceStore.getState().getActiveWorkspace();
    const activeProjPath = ws?.projectPath || '';
    if (!activeProjPath) return;
    await tauriService.openInExternalEditor(activeProjPath, targetPath);
  },
}));
