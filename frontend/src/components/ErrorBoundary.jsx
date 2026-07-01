import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0E14] text-aura-textLight font-mono flex flex-col items-center justify-center p-6 select-none scanline terminal-active">
          <div className="w-full max-w-lg p-8 border border-[#E24B4A]/40 bg-[#E24B4A]/5 relative shadow-2xl space-y-6">
            <span className="absolute top-2 left-2 text-[8px] font-mono text-[#E24B4A] opacity-80 uppercase tracking-widest">
              [CRITICAL_SYSTEM_FAULT]
            </span>

            <div className="space-y-2 border-b border-[#E24B4A]/20 pb-4">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                CORE_RENDERER_CRASHED
              </h2>
              <p className="text-[10px] text-aura-textMuted leading-relaxed">
                An unexpected exception halted the visual thread. The stack trace has been dumped to the operations console.
              </p>
            </div>

            <div className="p-4 bg-black/60 border border-aura-border text-xs text-[#E24B4A] overflow-x-auto max-h-40 rounded">
              <code>{this.state.error?.toString() || 'Unknown runtime error'}</code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[#E24B4A]/10 border border-[#E24B4A]/40 text-xs font-bold text-white hover:bg-[#E24B4A]/20 active:scale-95 transition-all"
              >
                Reset Deck & Return Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-black/40 border border-aura-border text-xs font-bold text-aura-textMuted hover:text-white active:scale-95 transition-all"
              >
                Force Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
