import { LineItem, Customer, Company } from "./types";

/**
 * Rounds a number to 2 decimal places.
 */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

interface CalculateLineItemInput {
  productId?: string | null;
  description: string;
  hsnCode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
}

/**
 * Calculates a single line item's values based on GST invoice settings and inter-state rules.
 */
export function calculateLineItem(
  item: CalculateLineItemInput,
  slNo: number,
  isGstInvoice: boolean,
  isInterState: boolean
): LineItem {
  const quantity = item.quantity || 0;
  const rate = item.rate || 0;
  const discountPercent = item.discountPercent || 0;
  const gstPercent = isGstInvoice ? item.gstPercent || 0 : 0;

  const rawTaxable = quantity * rate * (1 - discountPercent / 100);
  const taxableValue = roundToTwoDecimals(rawTaxable);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isGstInvoice) {
    if (isInterState) {
      igstAmount = roundToTwoDecimals(taxableValue * (gstPercent / 100));
    } else {
      cgstAmount = roundToTwoDecimals(taxableValue * (gstPercent / 200));
      sgstAmount = roundToTwoDecimals(taxableValue * (gstPercent / 200));
    }
  }

  const amount = roundToTwoDecimals(taxableValue + cgstAmount + sgstAmount + igstAmount);

  return {
    slNo,
    productId: item.productId || null,
    description: item.description,
    hsnCode: item.hsnCode || null,
    quantity,
    unit: item.unit,
    rate,
    discountPercent,
    gstPercent,
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    amount,
  };
}

interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  taxableValueTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Calculates totals for a set of line items and freight charge.
 */
export function calculateInvoiceTotals(
  lineItems: LineItem[],
  freight: number
): InvoiceTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableValueTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const item of lineItems) {
    const qty = item.quantity || 0;
    const rate = item.rate || 0;
    const discPercent = item.discountPercent || 0;

    subtotal += qty * rate;
    totalDiscount += qty * rate * (discPercent / 100);
    taxableValueTotal += item.taxableValue;
    cgstTotal += item.cgstAmount;
    sgstTotal += item.sgstAmount;
    igstTotal += item.igstAmount;
  }

  subtotal = roundToTwoDecimals(subtotal);
  totalDiscount = roundToTwoDecimals(totalDiscount);
  taxableValueTotal = roundToTwoDecimals(taxableValueTotal);
  cgstTotal = roundToTwoDecimals(cgstTotal);
  sgstTotal = roundToTwoDecimals(sgstTotal);
  igstTotal = roundToTwoDecimals(igstTotal);

  const rawGrandTotal = taxableValueTotal + cgstTotal + sgstTotal + igstTotal + (freight || 0);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundToTwoDecimals(roundedGrandTotal - rawGrandTotal);

  return {
    subtotal,
    totalDiscount,
    taxableValueTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}
