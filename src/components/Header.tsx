import { TrendingUp } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DeGiro Portfolio Tracker</h1>
              <p className="text-xs text-slate-400">Track your investments over time</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
