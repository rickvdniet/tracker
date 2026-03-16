# DeGiro Portfolio Tracker

A web-based investment portfolio tracker for DeGiro users. Track your holdings, monitor performance over time, and visualize your portfolio allocation.

## Features

- **Import DeGiro Transactions**: Upload your transaction history CSV from DeGiro
- **Portfolio Overview**: See your total portfolio value, invested amount, and profit/loss
- **Holdings Table**: View all your current positions with performance metrics
- **Performance Charts**: Track your portfolio growth over time with interactive charts
- **Allocation View**: Visualize your portfolio allocation with a pie chart
- **Manual Price Updates**: Update current prices to see accurate P/L calculations
- **Local Storage**: All data is stored locally in your browser
- **Export/Backup**: Export transactions to CSV or create full JSON backups

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

### Importing Transactions

1. Log in to your DeGiro account
2. Go to Activity > Transactions
3. Export your transactions as CSV
4. Click "Import CSV" in the tracker and select your file

### Updating Prices

Since this is a client-side only application, prices are not fetched automatically. You can manually update prices by:

1. Click on any price in the "Update Prices" section
2. Enter the current market price
3. Press Enter or click the checkmark to save

### Data Storage

All your data is stored locally in your browser's localStorage. Your data never leaves your device.

To backup your data, use the "Backup" button to download a JSON file with all your information.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- PapaParse (CSV parsing)
- date-fns
- Lucide React (icons)

## License

MIT
