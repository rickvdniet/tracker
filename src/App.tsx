import { PortfolioProvider } from './context/PortfolioContext';
import {
  Header,
  StatsCards,
  HoldingsTable,
  PortfolioChart,
  AllocationChart,
  ImportExport,
  TransactionsList,
  PriceUpdater,
} from './components';
import './index.css';

function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <ImportExport />
            <AllocationChart />
            <PriceUpdater />
          </div>
        </div>
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
