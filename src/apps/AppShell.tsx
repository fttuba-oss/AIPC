import type { ReactNode } from 'react';
import type { AppSession } from '../contracts';
import '../shared/styles.css';
export function AppShell({ session, tabs, active, onNavigate, children }: { session: AppSession; tabs: { id: string; label: string }[]; active: string; onNavigate: (id: string) => void; children: ReactNode }) {
 return <div className="role-app"><header className="app-header"><div><span className="app-brand">AIPC</span><h1>{session.role === 'teacher' ? 'Teacher workspace' : 'Student workspace'}</h1></div><span>{session.displayName}</span></header><nav aria-label={`${session.role} modules`}>{tabs.map(tab => <button key={tab.id} aria-current={active === tab.id ? 'page' : undefined} onClick={() => onNavigate(tab.id)}>{tab.label}</button>)}</nav><main className="app-content">{children}</main></div>;
}
