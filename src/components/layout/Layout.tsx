import { type ReactNode, useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import {
  LayoutDashboard,
  Search,
  MessageSquare,
  BookOpen,
  FileText,
  Shield,
  Globe,
} from 'lucide-react';
import { checkBhashiniStatus, SUPPORTED_LANGUAGES } from '../../services/bhashini';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'screening', label: 'Screening', icon: Search },
  { id: 'chat', label: 'Legal Assistant', icon: MessageSquare },
  { id: 'evidence', label: 'Evidence & Sources', icon: BookOpen },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export function Layout({ children }: { children: ReactNode }) {
  const { currentScreen, setCurrentScreen, jurisdiction, setJurisdiction, language, setLanguage } =
    useAppStore();
  const [bhashiniReady, setBhashiniReady] = useState(false);

  useEffect(() => {
    checkBhashiniStatus().then(s => setBhashiniReady(s.configured));
  }, []);

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-dark text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-accent" />
            <div>
              <h1 className="text-lg font-bold leading-tight">IP-SAKTI</h1>
              <p className="text-xs text-white/60">SAHAYAK</p>
            </div>
          </div>
          <p className="text-[10px] text-white/40 mt-2 leading-tight">
            AI-Powered IP & TK Screening Assistant
          </p>
        </div>

        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentScreen(item.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-white/15 text-white border-r-3 border-accent'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="w-3 h-3 text-white/40" />
            <div className="text-[10px] text-white/40">
              Language
            </div>
            {!bhashiniReady && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-white/10 text-white/30">
                EN only
              </span>
            )}
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-accent/50"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-primary-dark text-white">
                {lang.nativeName} — {lang.name}
              </option>
            ))}
          </select>
          {!bhashiniReady && language !== 'en' && (
            <p className="text-[9px] text-amber-400/70 mt-1">
              Bhashini not configured — English mode only
            </p>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="text-[10px] text-white/40 mb-2">
            Jurisdiction
          </div>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(['India', 'Global'] as const).map((j) => (
              <button
                key={j}
                onClick={() => setJurisdiction(j)}
                className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  jurisdiction === j
                    ? 'bg-accent text-primary-dark'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="text-[10px] text-white/30 text-center leading-tight">
            IP-SAKTI Sahayak provides preliminary screening only.
            <br />
            Not legal advice.
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text capitalize">
              {currentScreen === 'chat'
                ? 'Legal Assistant'
                : currentScreen === 'evidence'
                ? 'Evidence & Sources'
                : currentScreen}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                jurisdiction === 'India'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-purple-50 text-purple-700'
              }`}
            >
              {jurisdiction === 'India' ? '🇮🇳' : '🌍'} {jurisdiction}
            </span>

          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
