import { useState } from 'react';
import { PortfolioProvider } from './context/PortfolioContext';
import {
  Header,
  StatsCards,
  HoldingsTable,
  PortfolioChart,
  AllocationChart,
  ImportExport,
  TransactionsList,
  AddTransactionForm,
  DividendDashboard,
  PerformanceBenchmark,
  AutoPriceUpdater,
} from './components';
import { LayoutDashboard, Coins, TrendingUp, Settings, Check } from 'lucide-react';
import { getCustomProxyUrl, setCustomProxyUrl } from './utils/priceApi';
import './index.css';

type Tab = 'portfolio' | 'dividends' | 'benchmark' | 'settings';

function Navigation({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  const tabs = [
    { id: 'portfolio' as Tab, label: 'Portfolio', icon: LayoutDashboard },
    { id: 'dividends' as Tab, label: 'Dividends', icon: Coins },
    { id: 'benchmark' as Tab, label: 'Benchmark', icon: TrendingUp },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="border-b border-slate-700 bg-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function PortfolioView() {
  return (
    <>
      {/* Stats Overview */}
      <section className="mb-8">
        <StatsCards />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <PortfolioChart />
          <HoldingsTable />
          <TransactionsList />
        </div>

        {/* Right Column - Tools & Allocation */}
        <div className="space-y-6">
          <AddTransactionForm />
          <AllocationChart />
          <AutoPriceUpdater />
        </div>
      </div>
    </>
  );
}

function DividendsView() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Dividend Tracking</h2>
        <p className="text-slate-400 mt-1">Track your dividend income and projected yields</p>
      </div>
      <DividendDashboard />
    </>
  );
}

function BenchmarkView() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Performance Benchmark</h2>
        <p className="text-slate-400 mt-1">Compare your portfolio against major indices</p>
      </div>
      <PerformanceBenchmark />
    </>
  );
}

function ProxySettings() {
  const [url, setUrl] = useState(getCustomProxyUrl().replace(/\/\?url=$/, '').replace(/\/$/, ''));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setCustomProxyUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-lg font-semibold text-white mb-1">Price Fetch Proxy</h3>
      <p className="text-sm text-slate-400 mb-4">
        Yahoo Finance blocks direct browser requests (CORS). A personal Cloudflare Worker
        proxy bypasses this reliably for free.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Your Worker URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://my-proxy.yourname.workers.dev"
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
            >
              {saved ? <Check className="w-4 h-4" /> : null}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
          {url && (
            <p className="text-xs text-slate-500 mt-1">
              Will call: {url.replace(/\/$/, '')}/?url=&lt;encoded Yahoo Finance URL&gt;
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-slate-700">
          <p className="text-sm font-medium text-slate-300 mb-2">How to set up (free, ~5 min):</p>
          <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
            <li>Go to <span className="text-emerald-400">cloudflare.com</span> and create a free account</li>
            <li>Open <span className="text-white">Workers &amp; Pages</span> → <span className="text-white">Create</span> → <span className="text-white">Hello World</span> Worker</li>
            <li>Replace the worker code with the snippet below and click <span className="text-white">Deploy</span></li>
            <li>Copy the worker URL (e.g. <span className="text-slate-300">https://my-proxy.name.workers.dev</span>) and paste it above</li>
          </ol>
          <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre">{`export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url param', { status: 400 });
    const resp = await fetch(decodeURIComponent(target), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};`}</pre>
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Settings & Data Management</h2>
        <p className="text-slate-400 mt-1">Import, export, and manage your portfolio data</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportExport />
        <ProxySettings />
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">About</h3>
          <div className="space-y-3 text-sm text-slate-400">
            <p>
              DeGiro Portfolio Tracker is a client-side application for tracking your investment portfolio.
            </p>
            <p>
              All data is stored locally in your browser's localStorage. No data is sent to any server.
            </p>
            <div className="pt-3 border-t border-slate-700">
              <p className="font-medium text-slate-300 mb-2">Features:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Import transactions from DeGiro CSV exports</li>
                <li>Manual transaction entry</li>
                <li>Real-time portfolio value tracking</li>
                <li>Dividend income tracking and projections</li>
                <li>Performance comparison against benchmarks</li>
                <li>Notes and tags for holdings</li>
                <li>Auto price updates via Yahoo Finance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'portfolio' && <PortfolioView />}
        {activeTab === 'dividends' && <DividendsView />}
        {activeTab === 'benchmark' && <BenchmarkView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-slate-500">
            DeGiro Portfolio Tracker &bull; Your data is stored locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <PortfolioProvider>
      <Dashboard />
    </PortfolioProvider>
  );
}

export default App;
