import React, { useState } from 'react';
import { Folder } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService } from '../../services';

export const CreateWorkspaceModal: React.FC = () => {
  const { isCreateWorkspaceOpen, setCreateWorkspaceOpen } = useUIStore();
  const { createWorkspace } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Build default path from the OS home dir via Tauri path API, falling
      // back to '~' so the path is never hardcoded to a specific username.
      let homeDir = '~';
      try {
        const { homeDir: tauriHomeDir } = await import('@tauri-apps/api/path');
        homeDir = await tauriHomeDir();
      } catch (_) { /* web preview or Tauri not available */ }
      const slug = name.toLowerCase().trim().replace(/\s+/g, '-');
      const defaultPath = `${homeDir}/projects/${slug}`;
      await createWorkspace(name.trim(), projectPath.trim() || defaultPath);
      setName('');
      setProjectPath('');
      setError('');
      setCreateWorkspaceOpen(false);
    } catch (err) {
      setError('Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isCreateWorkspaceOpen}
      onClose={() => setCreateWorkspaceOpen(false)}
      title="Create Workspace"
      subtitle="Connect a project directory to launch multi-agent collaboration"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-mono">
        <div>
          <label className="text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1.5 block">
            Workspace Name
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Music App, GraphFlow, ShopIt API"
            autoFocus
            error={error}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-text-dim uppercase tracking-wider block">
              Project Folder Path
            </label>
            <button
              type="button"
              onClick={async () => {
                try {
                  const selectedPath = await tauriService.openFolderDialog();
                  if (selectedPath) {
                    setProjectPath(selectedPath);
                    if (!name.trim()) {
                      const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
                      setName(parts[parts.length - 1] || '');
                    }
                  }
                } catch (err) {
                  console.warn('Folder selection error:', err);
                }
              }}
              className="text-[10.5px] text-text-muted hover:text-text-primary underline font-mono flex items-center gap-1 cursor-pointer"
            >
              <Folder size={11} />
              <span>Browse Device...</span>
            </button>
          </div>
          <Input
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder={name ? `~/projects/${name.toLowerCase().replace(/\s+/g, '-')}` : '~/projects/my-app'}
            icon={<Folder size={14} />}
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCreateWorkspaceOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className="tracking-wider font-bold"
          >
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
};
