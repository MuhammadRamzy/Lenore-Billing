"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { hashPassword, signSession, verifySession } from "@/lib/auth";
import {
  getCompany,
  saveCompany,
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getProducts,
  saveProduct,
  deleteProduct,
  getInvoices,
  saveInvoice,
  deleteInvoice,
  getPurchases,
  savePurchase,
  deletePurchase,
  getCounters,
  saveCounters,
  saveStockLog,
  getExpenses,
  saveExpense,
  deleteExpense,
  getPasswordHash,
  savePasswordHash,
} from "@/lib/db";
import {
  Company,
  CompanySchema,
  Customer,
  CustomerSchema,
  Product,
  ProductSchema,
  Invoice,
  InvoiceSchema,
  Purchase,
  PurchaseSchema,
  Expense,
  ExpenseSchema,
  StockLog,
} from "@/lib/types";
import { calculateLineItem, calculateInvoiceTotals } from "@/lib/calculations";
import { numberToWords } from "@/lib/numberToWords";

// --- Stock Logging Helper ---
async function logStockChange(
  productId: string,
  type: "inward" | "outward" | "adjustment",
  quantity: number,
  previousStock: number,
  newStock: number,
  referenceId: string,
  referenceNo: string,
  notes: string = ""
) {
  try {
    await saveStockLog({
      id: uuidv4(),
      productId,
      date: new Date().toISOString(),
      type,
      quantity,
      previousStock,
      newStock,
      referenceId,
      referenceNo,
      notes,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging stock change:", error);
  }
}


async function verifyAuthSessionOrThrow() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized. Please log in first.");
  }
  const session = await verifySession(sessionCookie);
  if (!session || !session.authenticated) {
    throw new Error("Unauthorized. Session invalid or expired.");
  }
}

// --- Company Actions ---
export async function updateCompanyAction(data: Company) {
  await verifyAuthSessionOrThrow();
  const validated = CompanySchema.parse(data);
  await saveCompany(validated);
  revalidatePath("/", "layout");
  return { success: true };
}

// --- Customer Actions ---
export async function createCustomerAction(data: Omit<Customer, "id" | "createdAt">) {
  await verifyAuthSessionOrThrow();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  const customer: Customer = {
    ...data,
    id,
    createdAt,
  };

  const validated = CustomerSchema.parse(customer);
  await saveCustomer(validated);

  revalidatePath("/customers");
  revalidatePath("/invoices/new");
  return { success: true, customer: validated };
}

export async function updateCustomerAction(id: string, data: Omit<Customer, "id" | "createdAt">) {
  await verifyAuthSessionOrThrow();
  const customers = await getCustomers();
  const existing = customers.find((c) => c.id === id);
  if (!existing) {
    throw new Error("Customer not found");
  }

  const customer: Customer = {
    ...data,
    id,
    createdAt: existing.createdAt,
  };

  const validated = CustomerSchema.parse(customer);
  await saveCustomer(validated);

  revalidatePath("/customers");
  return { success: true, customer: validated };
}

export async function deleteCustomerAction(id: string) {
  await verifyAuthSessionOrThrow();
  await deleteCustomer(id);
  revalidatePath("/customers");
  revalidatePath("/invoices/new");
  return { success: true };
}

// --- Product Actions ---
export async function createProductAction(data: Omit<Product, "id">) {
  await verifyAuthSessionOrThrow();
  const id = uuidv4();
  const product: Product = {
    ...data,
    id,
  };

  const validated = ProductSchema.parse(product);
  await saveProduct(validated);

  if (validated.stock > 0) {
    await logStockChange(
      id,
      "adjustment",
      validated.stock,
      0,
      validated.stock,
      "manual",
      "Manual",
      "Initial stock on creation"
    );
  }

  revalidatePath("/products");
  revalidatePath("/invoices/new");
  revalidatePath("/dashboard");
  return { success: true, product: validated };
}

export async function updateProductAction(id: string, data: Omit<Product, "id">) {
  await verifyAuthSessionOrThrow();
  const products = await getProducts();
  const existing = products.find((p) => p.id === id);
  const oldStock = existing ? (existing.stock ?? 0) : 0;

  const product: Product = {
    ...data,
    id,
  };

  const validated = ProductSchema.parse(product);
  await saveProduct(validated);

  const newStock = validated.stock ?? 0;
  if (oldStock !== newStock) {
    await logStockChange(
      id,
      "adjustment",
      newStock - oldStock,
      oldStock,
      newStock,
      "manual",
      "Manual",
      "Manual adjustment during product edit"
    );
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { success: true, product: validated };
}

export async function deleteProductAction(id: string) {
  await verifyAuthSessionOrThrow();
  await deleteProduct(id);
  revalidatePath("/products");
  revalidatePath("/invoices/new");
  return { success: true };
}

// --- Invoice Actions ---

/**
 * Calculates the financial year of a given date (YYYY-MM-DD).
 * Financial year in India runs from April 1 to March 31.
 */
function getFinancialYear(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: April is 3

  let fyStart: number;
  if (month >= 3) {
    fyStart = year;
  } else {
    fyStart = year - 1;
  }
  
  const startStr = String(fyStart).slice(-2);
  const endStr = String(fyStart + 1).slice(-2);
  return `${startStr}-${endStr}`;
}

export async function createInvoiceAction(data: {
  invoiceDate: string;
  isGstInvoice: boolean;
  customerId: string;
  type: "invoice" | "quotation";
  meta: {
    deliveryNote?: string | null;
    buyersOrderNo?: string | null;
    buyersOrderDate?: string | null;
    dispatchDocNo?: string | null;
    dispatchedThrough?: string | null;
    paymentTerms: string;
    destination?: string | null;
    termsOfDelivery?: string | null;
    showLogo?: boolean;
    showBankDetails?: boolean;
    showDeclaration?: boolean;
    showTerms?: boolean;
  };
  lineItems: Array<{
    productId?: string | null;
    description: string;
    hsnCode?: string | null;
    quantity: number;
    unit: string;
    rate: number;
    discountPercent: number;
    gstPercent: number;
  }>;
  freight: number;
  remarks?: string | null;
  status: "draft" | "sent" | "paid" | "overdue";
}) {
  await verifyAuthSessionOrThrow();
  const company = await getCompany();
  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === data.customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  // Determine Inter-state vs Intra-state
  const isInterState = customer.stateCode !== company.stateCode;

  // Calculate line items on server
  const processedLineItems = data.lineItems.map((item, index) =>
    calculateLineItem(item, index + 1, data.isGstInvoice, isInterState)
  );

  // Calculate invoice totals
  const totals = calculateInvoiceTotals(processedLineItems, data.freight);

  // Get or create sequence for financial year
  const fy = getFinancialYear(data.invoiceDate);
  const counters = await getCounters();
  
  let nextSequence = 1;
  let invoiceNo = "";
  
  if (data.type === "quotation") {
    if (!counters.quotationCounters[fy]) {
      counters.quotationCounters[fy] = 0;
    }
    nextSequence = counters.quotationCounters[fy] + 1;
    counters.quotationCounters[fy] = nextSequence;
    const formattedSeq = String(nextSequence).padStart(4, "0");
    invoiceNo = `Q-${fy}/${formattedSeq}`;
  } else {
    if (!counters.invoiceCounters[fy]) {
      counters.invoiceCounters[fy] = 0;
    }
    nextSequence = counters.invoiceCounters[fy] + 1;
    counters.invoiceCounters[fy] = nextSequence;
    const formattedSeq = String(nextSequence).padStart(4, "0");
    invoiceNo = `${fy}/${formattedSeq}`;
  }

  const amountInWords = numberToWords(totals.grandTotal);

  const invoice: Invoice = {
    id: uuidv4(),
    invoiceNo,
    financialYear: fy,
    sequence: nextSequence,
    invoiceDate: data.invoiceDate,
    isGstInvoice: data.isGstInvoice,
    customerId: data.customerId,
    customerSnapshot: {
      name: customer.name,
      address: customer.address && customer.city ? `${customer.address}, ${customer.city}` : (customer.address || customer.city || ""),
      gstin: customer.gstin || null,
      state: customer.state || "",
      stateCode: customer.stateCode || "",
    },
    meta: {
      deliveryNote: data.meta.deliveryNote || null,
      buyersOrderNo: data.meta.buyersOrderNo || null,
      buyersOrderDate: data.meta.buyersOrderDate || null,
      dispatchDocNo: data.meta.dispatchDocNo || null,
      dispatchedThrough: data.meta.dispatchedThrough || null,
      paymentTerms: data.meta.paymentTerms,
      destination: data.meta.destination || null,
      termsOfDelivery: data.meta.termsOfDelivery || null,
      showLogo: data.meta.showLogo !== false,
      showBankDetails: data.meta.showBankDetails !== false,
      showDeclaration: data.meta.showDeclaration !== false,
      showTerms: data.meta.showTerms !== false,
    },
    lineItems: processedLineItems,
    freight: data.freight,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountInWords,
    status: data.status,
    remarks: data.remarks || null,
    type: data.type || "invoice",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(invoice);
  
  // Deduct product stock if it is a real invoice
  if (data.type === "invoice") {
    const products = await getProducts();
    for (const item of data.lineItems) {
      if (item.productId) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          const previousStock = prod.stock ?? 0;
          prod.stock = previousStock - item.quantity;
          await saveProduct(prod);
          
          await logStockChange(
            prod.id,
            "outward",
            -item.quantity,
            previousStock,
            prod.stock,
            validated.id,
            validated.invoiceNo,
            "Invoice Issued"
          );
        }
      }
    }
  }
  
  await saveInvoice(validated);
  await saveCounters(counters);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  
  return { success: true, invoice: validated };
}

export async function updateInvoiceAction(
  id: string,
  data: {
    invoiceDate: string;
    isGstInvoice: boolean;
    customerId: string;
    type: "invoice" | "quotation";
    meta: {
      deliveryNote?: string | null;
      buyersOrderNo?: string | null;
      buyersOrderDate?: string | null;
      dispatchDocNo?: string | null;
      dispatchedThrough?: string | null;
      paymentTerms: string;
      destination?: string | null;
      termsOfDelivery?: string | null;
      showLogo?: boolean;
      showBankDetails?: boolean;
      showDeclaration?: boolean;
      showTerms?: boolean;
    };
    lineItems: Array<{
      productId?: string | null;
      description: string;
      hsnCode?: string | null;
      quantity: number;
      unit: string;
      rate: number;
      discountPercent: number;
      gstPercent: number;
    }>;
    freight: number;
    remarks?: string | null;
    status: "draft" | "sent" | "paid" | "overdue";
  }
) {
  await verifyAuthSessionOrThrow();
  const invoices = await getInvoices();
  const index = invoices.findIndex((inv) => inv.id === id);
  if (index === -1) {
    throw new Error("Invoice not found");
  }

  const existingInvoice = invoices[index];
  const company = await getCompany();
  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === data.customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const isInterState = customer.stateCode !== company.stateCode;

  const processedLineItems = data.lineItems.map((item, index) =>
    calculateLineItem(item, index + 1, data.isGstInvoice, isInterState)
  );

  const totals = calculateInvoiceTotals(processedLineItems, data.freight);
  const amountInWords = numberToWords(totals.grandTotal);

  const oldType = existingInvoice.type || "invoice";
  const newType = data.type || "invoice";

  let invoiceNo = existingInvoice.invoiceNo;
  let sequence = existingInvoice.sequence;
  let fy = existingInvoice.financialYear;

  // Re-sequence if converting from quotation to invoice
  if (oldType === "quotation" && newType === "invoice") {
    const fyNow = getFinancialYear(data.invoiceDate);
    const counters = await getCounters();
    if (!counters.invoiceCounters[fyNow]) {
      counters.invoiceCounters[fyNow] = 0;
    }
    const nextSeq = counters.invoiceCounters[fyNow] + 1;
    counters.invoiceCounters[fyNow] = nextSeq;
    await saveCounters(counters);

    const formattedSeq = String(nextSeq).padStart(4, "0");
    invoiceNo = `${fyNow}/${formattedSeq}`;
    sequence = nextSeq;
    fy = fyNow;
  }

  // Adjust stock levels
  const products = await getProducts();
  const modifiedProductIds = new Set<string>();
  
  // 1. Add back stock of old invoice items if it was a real invoice
  if (oldType === "invoice") {
    for (const oldItem of existingInvoice.lineItems) {
      if (oldItem.productId) {
        const prod = products.find((p) => p.id === oldItem.productId);
        if (prod) {
          prod.stock = (prod.stock ?? 0) + oldItem.quantity;
          modifiedProductIds.add(oldItem.productId);
        }
      }
    }
  }

  // 2. Subtract stock of new invoice items if it is a real invoice
  if (newType === "invoice") {
    for (const newItem of data.lineItems) {
      if (newItem.productId) {
        const prod = products.find((p) => p.id === newItem.productId);
        if (prod) {
          prod.stock = (prod.stock ?? 0) - newItem.quantity;
          modifiedProductIds.add(newItem.productId);
        }
      }
    }
  }

  // Save only the modified products!
  for (const pid of modifiedProductIds) {
    const prod = products.find((p) => p.id === pid);
    if (prod) {
      await saveProduct(prod);
      
      const oldQty = (oldType === "invoice") ? (existingInvoice.lineItems.find((item) => item.productId === pid)?.quantity || 0) : 0;
      const newQty = (newType === "invoice") ? (data.lineItems.find((item) => item.productId === pid)?.quantity || 0) : 0;
      const netQtyChange = newQty - oldQty;

      if (netQtyChange !== 0) {
        await logStockChange(
          prod.id,
          "outward",
          -netQtyChange,
          prod.stock + netQtyChange,
          prod.stock,
          existingInvoice.id,
          invoiceNo,
          `Invoice Updated (Net Change: ${netQtyChange > 0 ? "+" : ""}${netQtyChange})`
        );
      }
    }
  }

  const updatedInvoice: Invoice = {
    ...existingInvoice,
    invoiceNo,
    sequence,
    financialYear: fy,
    invoiceDate: data.invoiceDate,
    isGstInvoice: data.isGstInvoice,
    customerId: data.customerId,
    customerSnapshot: {
      name: customer.name,
      address: customer.address && customer.city ? `${customer.address}, ${customer.city}` : (customer.address || customer.city || ""),
      gstin: customer.gstin || null,
      state: customer.state || "",
      stateCode: customer.stateCode || "",
    },
    meta: {
      deliveryNote: data.meta.deliveryNote || null,
      buyersOrderNo: data.meta.buyersOrderNo || null,
      buyersOrderDate: data.meta.buyersOrderDate || null,
      dispatchDocNo: data.meta.dispatchDocNo || null,
      dispatchedThrough: data.meta.dispatchedThrough || null,
      paymentTerms: data.meta.paymentTerms,
      destination: data.meta.destination || null,
      termsOfDelivery: data.meta.termsOfDelivery || null,
      showLogo: data.meta.showLogo !== false,
      showBankDetails: data.meta.showBankDetails !== false,
      showDeclaration: data.meta.showDeclaration !== false,
      showTerms: data.meta.showTerms !== false,
    },
    lineItems: processedLineItems,
    freight: data.freight,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountInWords,
    status: data.status,
    remarks: data.remarks || null,
    type: newType,
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(updatedInvoice);
  await saveInvoice(validated);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true, invoice: validated };
}

export async function updateInvoiceStatusAction(
  id: string,
  status: "draft" | "sent" | "paid" | "overdue"
) {
  await verifyAuthSessionOrThrow();
  const invoices = await getInvoices();
  const existing = invoices.find((inv) => inv.id === id);
  if (!existing) {
    throw new Error("Invoice not found");
  }

  existing.status = status;
  existing.updatedAt = new Date().toISOString();

  await saveInvoice(existing);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true };
}

export async function deleteInvoiceAction(id: string) {
  await verifyAuthSessionOrThrow();
  const invoices = await getInvoices();
  const existingInvoice = invoices.find((inv) => inv.id === id);
  if (!existingInvoice) {
    throw new Error("Invoice not found");
  }

  // Restore stock if the deleted invoice was a real invoice
  if (existingInvoice.type === "invoice") {
    const products = await getProducts();
    for (const item of existingInvoice.lineItems) {
      if (item.productId) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          const previousStock = prod.stock ?? 0;
          prod.stock = previousStock + item.quantity;
          await saveProduct(prod);
          
          await logStockChange(
            prod.id,
            "inward",
            item.quantity,
            previousStock,
            prod.stock,
            existingInvoice.id,
            existingInvoice.invoiceNo,
            "Invoice Deleted (Stock Returned)"
          );
        }
      }
    }
  }

  await deleteInvoice(id);
  
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { success: true };
}

export async function convertQuotationToInvoiceAction(id: string) {
  await verifyAuthSessionOrThrow();
  const invoices = await getInvoices();
  const existingInvoice = invoices.find((inv) => inv.id === id);
  if (!existingInvoice) {
    throw new Error("Quotation not found");
  }

  if (existingInvoice.type !== "quotation") {
    throw new Error("Document is not a quotation");
  }

  // Generate new invoice number
  const fyNow = getFinancialYear(existingInvoice.invoiceDate);
  const counters = await getCounters();
  if (!counters.invoiceCounters[fyNow]) {
    counters.invoiceCounters[fyNow] = 0;
  }
  const nextSeq = counters.invoiceCounters[fyNow] + 1;
  counters.invoiceCounters[fyNow] = nextSeq;

  const formattedSeq = String(nextSeq).padStart(4, "0");
  const invoiceNo = `${fyNow}/${formattedSeq}`;

  // Deduct stock for all line items and save only modified products
  const products = await getProducts();
  for (const item of existingInvoice.lineItems) {
    if (item.productId) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const previousStock = prod.stock ?? 0;
        prod.stock = previousStock - item.quantity;
        await saveProduct(prod);
        
        await logStockChange(
          prod.id,
          "outward",
          -item.quantity,
          previousStock,
          prod.stock,
          existingInvoice.id,
          invoiceNo,
          "Converted from Quotation"
        );
      }
    }
  }

  // Update document properties
  existingInvoice.type = "invoice";
  existingInvoice.invoiceNo = invoiceNo;
  existingInvoice.sequence = nextSeq;
  existingInvoice.financialYear = fyNow;
  existingInvoice.status = "sent";
  existingInvoice.updatedAt = new Date().toISOString();

  await saveInvoice(existingInvoice);
  await saveCounters(counters);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true, invoice: existingInvoice };
}

// --- Purchase Actions ---

export async function createPurchaseAction(data: {
  purchaseDate: string;
  isGstPurchase: boolean;
  supplierName: string;
  supplierGstin?: string | null;
  supplierAddress?: string | null;
  supplierBillNo?: string | null;
  lineItems: {
    productId?: string | null;
    description: string;
    hsnCode?: string | null;
    quantity: number;
    unit: string;
    rate: number;
    discountPercent: number;
    gstPercent: number;
  }[];
  freight: number;
  status: "pending" | "paid";
  remarks?: string | null;
}) {
  await verifyAuthSessionOrThrow();
  const company = await getCompany();

  let isInterState = false;
  if (data.supplierGstin && data.supplierGstin.length >= 2) {
    const supplierStateCode = data.supplierGstin.substring(0, 2);
    isInterState = supplierStateCode !== company.stateCode;
  }

  const processedLineItems = data.lineItems.map((item, index) =>
    calculateLineItem(item, index + 1, data.isGstPurchase, isInterState)
  );

  const totals = calculateInvoiceTotals(processedLineItems, data.freight);

  const fy = getFinancialYear(data.purchaseDate);
  const counters = await getCounters();
  if (!counters.purchaseCounters) {
    counters.purchaseCounters = {};
  }
  if (!counters.purchaseCounters[fy]) {
    counters.purchaseCounters[fy] = 0;
  }
  const nextSequence = counters.purchaseCounters[fy] + 1;
  counters.purchaseCounters[fy] = nextSequence;
  const formattedSeq = String(nextSequence).padStart(4, "0");
  const purchaseNo = `PUR-${fy}/${formattedSeq}`;

  const purchase: Purchase = {
    id: uuidv4(),
    purchaseNo,
    supplierBillNo: data.supplierBillNo || "",
    purchaseDate: data.purchaseDate,
    isGstPurchase: data.isGstPurchase,
    supplierName: data.supplierName,
    supplierGstin: data.supplierGstin || "",
    supplierAddress: data.supplierAddress || "",
    lineItems: processedLineItems,
    freight: data.freight,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    status: data.status,
    remarks: data.remarks || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validated = PurchaseSchema.parse(purchase);

  const products = await getProducts();
  for (const item of data.lineItems) {
    if (item.productId) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const previousStock = prod.stock ?? 0;
        prod.stock = previousStock + item.quantity;
        await saveProduct(prod);
        
        await logStockChange(
          prod.id,
          "inward",
          item.quantity,
          previousStock,
          prod.stock,
          validated.id,
          validated.purchaseNo,
          "Purchase Intake"
        );
      }
    }
  }

  await savePurchase(validated);
  await saveCounters(counters);

  revalidatePath("/dashboard");
  revalidatePath("/purchases");

  return { success: true, purchase: validated };
}

export async function updatePurchaseAction(
  id: string,
  data: {
    purchaseDate: string;
    isGstPurchase: boolean;
    supplierName: string;
    supplierGstin?: string | null;
    supplierAddress?: string | null;
    supplierBillNo?: string | null;
    lineItems: {
      productId?: string | null;
      description: string;
      hsnCode?: string | null;
      quantity: number;
      unit: string;
      rate: number;
      discountPercent: number;
      gstPercent: number;
    }[];
    freight: number;
    status: "pending" | "paid";
    remarks?: string | null;
  }
) {
  await verifyAuthSessionOrThrow();
  const purchases = await getPurchases();
  const existingPurchase = purchases.find((p) => p.id === id);
  if (!existingPurchase) {
    throw new Error("Purchase not found");
  }

  const company = await getCompany();

  let isInterState = false;
  if (data.supplierGstin && data.supplierGstin.length >= 2) {
    const supplierStateCode = data.supplierGstin.substring(0, 2);
    isInterState = supplierStateCode !== company.stateCode;
  }

  const processedLineItems = data.lineItems.map((item, index) =>
    calculateLineItem(item, index + 1, data.isGstPurchase, isInterState)
  );

  const totals = calculateInvoiceTotals(processedLineItems, data.freight);

  const products = await getProducts();
  const modifiedProductIds = new Set<string>();
  
  for (const oldItem of existingPurchase.lineItems) {
    if (oldItem.productId) {
      const prod = products.find((p) => p.id === oldItem.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock ?? 0) - oldItem.quantity);
        await saveProduct(prod);
        modifiedProductIds.add(oldItem.productId);
      }
    }
  }

  for (const newItem of data.lineItems) {
    if (newItem.productId) {
      const prod = products.find((p) => p.id === newItem.productId);
      if (prod) {
        prod.stock = (prod.stock ?? 0) + newItem.quantity;
        await saveProduct(prod);
        modifiedProductIds.add(newItem.productId);
      }
    }
  }

  for (const pid of modifiedProductIds) {
    const prod = products.find((p) => p.id === pid);
    if (prod) {
      const oldQty = existingPurchase.lineItems.find((item) => item.productId === pid)?.quantity || 0;
      const newQty = data.lineItems.find((item) => item.productId === pid)?.quantity || 0;
      const netQtyChange = newQty - oldQty;

      if (netQtyChange !== 0) {
        await logStockChange(
          prod.id,
          "inward",
          netQtyChange,
          prod.stock - netQtyChange,
          prod.stock,
          existingPurchase.id,
          existingPurchase.purchaseNo,
          `Purchase Updated (Net Change: ${netQtyChange > 0 ? "+" : ""}${netQtyChange})`
        );
      }
    }
  }

  const fyOld = existingPurchase.purchaseNo.split("/")[0].replace("PUR-", "");
  const fyNow = getFinancialYear(data.purchaseDate);
  let purchaseNo = existingPurchase.purchaseNo;
  let nextSeq = existingPurchase.purchaseNo.split("/")[1] ? parseInt(existingPurchase.purchaseNo.split("/")[1]) : 1;

  if (fyOld !== fyNow) {
    const counters = await getCounters();
    if (!counters.purchaseCounters) {
      counters.purchaseCounters = {};
    }
    if (!counters.purchaseCounters[fyNow]) {
      counters.purchaseCounters[fyNow] = 0;
    }
    nextSeq = counters.purchaseCounters[fyNow] + 1;
    counters.purchaseCounters[fyNow] = nextSeq;
    const formattedSeq = String(nextSeq).padStart(4, "0");
    purchaseNo = `PUR-${fyNow}/${formattedSeq}`;
    await saveCounters(counters);
  }

  const purchase: Purchase = {
    ...existingPurchase,
    purchaseNo,
    supplierBillNo: data.supplierBillNo || "",
    purchaseDate: data.purchaseDate,
    isGstPurchase: data.isGstPurchase,
    supplierName: data.supplierName,
    supplierGstin: data.supplierGstin || "",
    supplierAddress: data.supplierAddress || "",
    lineItems: processedLineItems,
    freight: data.freight,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    status: data.status,
    remarks: data.remarks || "",
    updatedAt: new Date().toISOString(),
  };

  const validated = PurchaseSchema.parse(purchase);
  await savePurchase(validated);

  revalidatePath("/dashboard");
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);

  return { success: true, purchase: validated };
}

export async function deletePurchaseAction(id: string) {
  await verifyAuthSessionOrThrow();
  const purchases = await getPurchases();
  const existingPurchase = purchases.find((p) => p.id === id);
  if (!existingPurchase) {
    throw new Error("Purchase not found");
  }

  const products = await getProducts();
  for (const item of existingPurchase.lineItems) {
    if (item.productId) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const previousStock = prod.stock ?? 0;
        prod.stock = Math.max(0, previousStock - item.quantity);
        await saveProduct(prod);
        
        await logStockChange(
          prod.id,
          "outward",
          -item.quantity,
          previousStock,
          prod.stock,
          existingPurchase.id,
          existingPurchase.purchaseNo,
          "Purchase Deleted (Stock Removed)"
        );
      }
    }
  }

  await deletePurchase(id);

  revalidatePath("/dashboard");
  revalidatePath("/purchases");

  return { success: true };
}

// --- Expense Actions ---
export async function createExpenseAction(data: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  await verifyAuthSessionOrThrow();
  const id = uuidv4();
  const now = new Date().toISOString();

  const expense: Expense = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const validated = ExpenseSchema.parse(expense);
  await saveExpense(validated);

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true, expense: validated };
}

export async function updateExpenseAction(id: string, data: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  await verifyAuthSessionOrThrow();
  const expenses = await getExpenses();
  const existing = expenses.find((e) => e.id === id);
  if (!existing) {
    throw new Error("Expense not found");
  }

  const expense: Expense = {
    ...data,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const validated = ExpenseSchema.parse(expense);
  await saveExpense(validated);

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true, expense: validated };
}

export async function deleteExpenseAction(id: string) {
  await verifyAuthSessionOrThrow();
  await deleteExpense(id);
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true };
}

// --- Manual Stock Adjustment Action ---
export async function recordManualStockAdjustmentAction(productId: string, quantity: number, notes: string) {
  await verifyAuthSessionOrThrow();
  const products = await getProducts();
  const prod = products.find((p) => p.id === productId);
  if (!prod) {
    throw new Error("Product not found");
  }

  const previousStock = prod.stock ?? 0;
  const newStock = Math.max(0, previousStock + quantity);
  prod.stock = newStock;
  await saveProduct(prod);

  await logStockChange(
    productId,
    "adjustment",
    quantity,
    previousStock,
    newStock,
    "manual",
    "Manual",
    notes || "Manual stock adjustment"
  );

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { success: true, product: prod };
}

// --- Auth Actions ---
export async function loginAction(password: string) {
  try {
    const savedHash = await getPasswordHash();
    const enteredHash = await hashPassword(password);
    
    if (savedHash === enteredHash) {
      const payload = {
        authenticated: true,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      };
      
      const token = await signSession(payload);
      const cookieStore = await cookies();
      cookieStore.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
      
      return { success: true };
    }
    
    return { success: false, error: "Incorrect password" };
  } catch (error: any) {
    console.error("Login action error:", error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Failed to logout" };
  }
}

export async function changePasswordAction(oldPassword: string, newPassword: string) {
  try {
    const savedHash = await getPasswordHash();
    const oldHash = await hashPassword(oldPassword);
    
    if (savedHash !== oldHash) {
      return { success: false, error: "Incorrect current password" };
    }
    
    const newHash = await hashPassword(newPassword);
    await savePasswordHash(newHash);
    
    // Renew the session cookie with the new password signature
    const payload = {
      authenticated: true,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    
    const token = await signSession(payload);
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Change password action error:", error);
    return { success: false, error: error.message || "Failed to update password" };
  }
}

