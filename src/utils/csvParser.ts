import Papa from 'papaparse';
import type { Transaction } from '../types';

interface DeGiroTransactionRow {
  Datum: string;
  Tijd?: string;
  Product: string;
  ISIN: string;
  Beurs?: string;
  Uitvoeringsplaats?: string;
  Aantal?: string;
  Koers?: string;
  'Lokale waarde'?: string;
  Waarde?: string;
  Wisselkoers?: string;
  'Transactiekosten en/of'?: string;
  Totaal?: string;
  'Order ID'?: string;
  Omschrijving?: string;
  Mutatie?: string;
  Saldo?: string;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  // DeGiro uses comma as decimal separator
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseDate(dateStr: string): Date {
  // DeGiro format: DD-MM-YYYY
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

function determineTransactionType(row: DeGiroTransactionRow): Transaction['type'] {
  const description = (row.Omschrijving || row.Product || '').toLowerCase();
  const quantity = parseNumber(row.Aantal);
  const total = parseNumber(row.Totaal || row.Mutatie);

  if (description.includes('dividend')) return 'dividend';
  if (description.includes('fee') || description.includes('kosten')) return 'fee';
  if (description.includes('deposit') || description.includes('storting')) return 'deposit';
  if (description.includes('withdrawal') || description.includes('opname')) return 'withdrawal';

  if (quantity > 0 || total < 0) return 'buy';
  if (quantity < 0 || total > 0) return 'sell';

  return 'buy';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function parseDeGiroTransactions(csvContent: string): Transaction[] {
  const result = Papa.parse<DeGiroTransactionRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  const transactions: Transaction[] = [];

  for (const row of result.data) {
    // Skip rows without a date or product
    if (!row.Datum || (!row.Product && !row.Omschrijving)) continue;

    const type = determineTransactionType(row);
    const quantity = Math.abs(parseNumber(row.Aantal));
    const price = parseNumber(row.Koers);
    const total = parseNumber(row.Totaal || row.Mutatie);
    const fees = parseNumber(row['Transactiekosten en/of']);

    // Skip cash account movements that aren't deposits/withdrawals
    if (!row.ISIN && type !== 'deposit' && type !== 'withdrawal' && type !== 'dividend') {
      continue;
    }

    const transaction: Transaction = {
      id: generateId(),
      date: parseDate(row.Datum),
      type,
      product: row.Product || row.Omschrijving || '',
      isin: row.ISIN || '',
      quantity: type === 'sell' ? -quantity : quantity,
      price,
      totalAmount: Math.abs(total),
      currency: 'EUR',
      exchangeRate: parseNumber(row.Wisselkoers) || 1,
      fees: fees > 0 ? fees : undefined,
    };

    transactions.push(transaction);
  }

  // Sort by date ascending
  return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function parseDeGiroAccountStatement(csvContent: string): Transaction[] {
  // Account statement format (different from transactions)
  const result = Papa.parse<DeGiroTransactionRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const transactions: Transaction[] = [];

  for (const row of result.data) {
    if (!row.Datum) continue;

    const description = (row.Omschrijving || '').toLowerCase();
    const mutation = parseNumber(row.Mutatie);

    let type: Transaction['type'] = 'fee';
    if (description.includes('dividend')) type = 'dividend';
    else if (description.includes('storting') || description.includes('deposit')) type = 'deposit';
    else if (description.includes('opname') || description.includes('withdrawal')) type = 'withdrawal';
    else if (mutation < 0) type = 'buy';
    else if (mutation > 0) type = 'sell';

    transactions.push({
      id: generateId(),
      date: parseDate(row.Datum),
      type,
      product: row.Product || row.Omschrijving || '',
      isin: row.ISIN || '',
      quantity: 0,
      price: 0,
      totalAmount: Math.abs(mutation),
      currency: 'EUR',
    });
  }

  return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function exportTransactionsToCSV(transactions: Transaction[]): string {
  const data = transactions.map((t) => ({
    Date: t.date.toISOString().split('T')[0],
    Type: t.type,
    Product: t.product,
    ISIN: t.isin,
    Quantity: t.quantity,
    Price: t.price,
    'Total Amount': t.totalAmount,
    Currency: t.currency,
    Fees: t.fees || '',
  }));

  return Papa.unparse(data);
}
