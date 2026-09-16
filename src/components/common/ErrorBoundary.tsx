import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Orbit ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReturnHome = () => {
    try {
      localStorage.removeItem('orbit_last_active_workspace_id_v1');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full min-h-[300px] bg-[#09090B] text-white flex flex-col items-center justify-center p-6 select-text">
          <div className="max-w-2xl w-full bg-zinc-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} className="shrink-0" />
              <h2 className="text-base font-mono font-bold">
                Orbit Render Error Caught {this.props.name ? `[${this.props.name}]` : ''}
              </h2>
            </div>
            <p className="text-xs font-mono text-zinc-300">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            {this.state.error?.stack && (
              <pre className="p-3 bg-black/60 border border-zinc-800 rounded-xl font-mono text-[11px] text-zinc-400 max-h-60 overflow-auto whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw size={13} />
                <span>Retry</span>
              </button>
              <button
                onClick={this.handleReturnHome}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Home size={13} />
                <span>Return to Projects</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
