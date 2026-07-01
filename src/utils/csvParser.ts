import Papa from 'papaparse';
import type { Transaction } from '../types';
import { getPriceCurrency } from './priceApi';

// DeGiro CSV can be in different languages - we need to support common variations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeGiroTransactionRow = Record<string, any>;

// Column name mappings for different languages and export formats
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['Datum', 'Date', 'Fecha', 'Data'],
  time: ['Tijd', 'Time', 'Hora', 'Ora'],
  product: ['Product', 'Produkt', 'Producto', 'Prodotto'],
  isin: ['ISIN'],
  exchange: ['Beurs', 'Exchange', 'Bolsa', 'Borsa'],
  quantity: ['Aantal', 'Quantity', 'Number', 'Cantidad', 'Quantità'],
  price: ['Koers', 'Price', 'Precio', 'Prezzo'],
  localValue: ['Lokale waarde', 'Local value', 'Valor local', 'Valore locale'],
  value: ['Waarde', 'Value', 'Valor', 'Valore'],
  exchangeRate: ['Wisselkoers', 'Exchange rate', 'Tipo de cambio', 'Tasso di cambio', 'FX Rate'],
  fees: ['Transactiekosten en/of', 'Transaction costs', 'Transaction and/or', 'Costes de transacción', 'Fees'],
  total: ['Totaal', 'Total', 'Total Amount'],
  orderId: ['Order ID', 'Order Id'],
  description: ['Omschrijving', 'Description', 'Descripción', 'Descrizione'],
  mutation: ['Mutatie', 'Mutation', 'Change'],
  balance: ['Saldo', 'Balance'],
  type: ['Type'],  // For re-importing tracker exports
  currency: ['Currency'],  // For re-importing tracker exports
};

// Find the value for a field using any of its aliases
function getField(row: DeGiroTransactionRow, fieldName: string): string | undefined {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== '') {
      return String(row[alias]);
    }
  }
  return undefined;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  // DeGiro uses comma as decimal separator
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseDate(dateStr: string): Date {
  // ISO format: YYYY-MM-DD (used by our own CSV export and modern DeGiro exports)
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateStr);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  // DeGiro Dutch format: DD-MM-YYYY (or D-M-YYYY)
  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(dateStr);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day);
  }

  return new Date(dateStr);
}

/**
 * Recover a date that was corrupted by the old parseDate bug.
 * The bug: given ISO date "YYYY-MM-DD", parseDate did new Date(year=DD, month=MM-1, day=YYYY),
 * which produced dates in the 1900s due to two-digit-year handling + day overflow.
 *
 * Given the corrupted output, iterate over plausible (year, month, day) triples
 * to find one that reproduces the corrupted date. Returns the reconstruction
 * closest to today's year.
 */
export function recoverCorruptedDate(corrupted: Date): Date | null {
  const currentYear = new Date().getFullYear();
  let best: { date: Date; distance: number } | null = null;

  for (let dayField = 1; dayField <= 31; dayField++) {
    for (let monthField = 0; monthField < 12; monthField++) {
      // Original CSV had: year=YYYY, month=monthField+1, day=dayField
      // Buggy Date call was: new Date(dayField, monthField, YYYY)
      // JS treats dayField (1-31) as 1901-1931, then adds YYYY-1 days
      const baseYear = 1900 + dayField;
      const base = new Date(baseYear, monthField, 1);
      const diffMs = corrupted.getTime() - base.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const yyyy = diffDays + 1;

      if (yyyy < 1970 || yyyy > 2100) continue;

      // Verify: reconstructing via the buggy formula should match
      const check = new Date(dayField, monthField, yyyy);
      if (Math.abs(check.getTime() - corrupted.getTime()) > 60 * 60 * 1000) continue;

      const recovered = new Date(yyyy, monthField, dayField);
      const distance = Math.abs(recovered.getFullYear() - currentYear);

      if (!best || distance < best.distance) {
        best = { date: recovered, distance };
      }
    }
  }

  return best?.date ?? null;
}

function determineTransactionType(row: DeGiroTransactionRow): Transaction['type'] {
  // If there's an explicit Type column (from tracker export), use it
  const explicitType = getField(row, 'type')?.toLowerCase();
  if (explicitType && ['buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal'].includes(explicitType)) {
    return explicitType as Transaction['type'];
  }

  const description = (getField(row, 'description') || getField(row, 'product') || '').toLowerCase();
  const quantity = parseNumber(getField(row, 'quantity'));
  const total = parseNumber(getField(row, 'total') || getField(row, 'mutation'));

  if (description.includes('dividend')) return 'dividend';
  if (description.includes('fee') || description.includes('kosten') || description.includes('cost')) return 'fee';
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

  // Debug: log found columns
  if (result.data.length > 0) {
    console.log('CSV columns found:', Object.keys(result.data[0]));
    console.log('First row raw:', result.data[0]);
    // Debug currency specifically
    const firstRow = result.data[0];
    console.log('Currency column check:', {
      hasCurrency: 'Currency' in firstRow,
      currencyValue: firstRow['Currency'],
      getFieldResult: getField(firstRow, 'currency'),
    });
  } else {
    console.warn('CSV has no data rows');
  }

  const transactions: Transaction[] = [];

  for (const row of result.data) {
    const dateStr = getField(row, 'date');
    const product = getField(row, 'product');
    const description = getField(row, 'description');

    // Skip rows without a date or product
    if (!dateStr || (!product && !description)) continue;

    const type = determineTransactionType(row);
    const quantity = Math.abs(parseNumber(getField(row, 'quantity')));
    const price = parseNumber(getField(row, 'price'));
    const total = parseNumber(getField(row, 'total') || getField(row, 'mutation'));
    const fees = parseNumber(getField(row, 'fees'));

    const isin = getField(row, 'isin') || '';

    // Skip cash account movements that aren't deposits/withdrawals
    if (!isin && type !== 'deposit' && type !== 'withdrawal' && type !== 'dividend') {
      continue;
    }

    // Use explicit currency if present (tracker export), otherwise infer from ISIN
    const explicitCurrency = getField(row, 'currency');
    const inferredCurrency = isin ? getPriceCurrency(isin) : null;
    const currency = explicitCurrency || inferredCurrency || 'EUR';

    // Debug currency for SEK stocks
    if (isin && isin.startsWith('SE')) {
      console.log('SEK stock currency debug:', { isin, product, explicitCurrency, inferredCurrency, finalCurrency: currency });
    }

    // For tracker exports, quantity may already be negative for sells
    const rawQuantity = parseNumber(getField(row, 'quantity'));
    const finalQuantity = explicitCurrency
      ? rawQuantity  // Tracker export: keep as-is (already signed correctly)
      : (type === 'sell' ? -quantity : quantity);  // DeGiro: apply sign

    const transaction: Transaction = {
      id: generateId(),
      date: parseDate(dateStr),
      type,
      product: product || description || '',
      isin,
      quantity: finalQuantity,
      price,
      totalAmount: Math.abs(total),
      currency,
      exchangeRate: parseNumber(getField(row, 'exchangeRate')) || undefined,
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
    const dateStr = getField(row, 'date');
    if (!dateStr) continue;

    const description = (getField(row, 'description') || '').toLowerCase();
    const mutation = parseNumber(getField(row, 'mutation'));

    let type: Transaction['type'] = 'fee';
    if (description.includes('dividend')) type = 'dividend';
    else if (description.includes('storting') || description.includes('deposit')) type = 'deposit';
    else if (description.includes('opname') || description.includes('withdrawal')) type = 'withdrawal';
    else if (mutation < 0) type = 'buy';
    else if (mutation > 0) type = 'sell';

    const isin = getField(row, 'isin') || '';
    const inferredCurrency = isin ? getPriceCurrency(isin) : null;

    transactions.push({
      id: generateId(),
      date: parseDate(dateStr),
      type,
      product: getField(row, 'product') || getField(row, 'description') || '',
      isin,
      quantity: 0,
      price: 0,
      totalAmount: Math.abs(mutation),
      currency: inferredCurrency || 'EUR',
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
    'Exchange rate': t.exchangeRate || '',
    Fees: t.fees || '',
  }));

  return Papa.unparse(data);
}
