import React from 'react';

export class StudentStartupBoundary extends React.Component<{ children: React.ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'The practice viewer could not open.' };
  }
  render() {
    if (!this.state.message) return this.props.children;
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div role="alert" className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-800">
        <h1 className="text-xl font-bold">Unable to open AIPC</h1>
        <p className="mt-3">Try reloading. If this continues, share the details below so we can identify the problem.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-3 text-white">Reload</button>
        <details className="mt-4 text-sm"><summary>Error details</summary><p className="mt-2 break-words">{this.state.message}</p><p className="mt-2 break-words">{navigator.userAgent}</p></details>
      </div>
    </main>;
  }
}
