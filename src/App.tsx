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
import { LayoutDashboard, Coins, TrendingUp, Settings } from 'lucide-react';
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

function SettingsView() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Settings & Data Management</h2>
        <p className="text-slate-400 mt-1">Import, export, and manage your portfolio data</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportExport />
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
