"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
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
  getCounters,
  saveCounters,
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
} from "@/lib/types";
import { calculateLineItem, calculateInvoiceTotals } from "@/lib/calculations";
import { numberToWords } from "@/lib/numberToWords";

// --- Company Actions ---
export async function updateCompanyAction(data: Company) {
  const validated = CompanySchema.parse(data);
  await saveCompany(validated);
  revalidatePath("/", "layout");
  return { success: true };
}

// --- Customer Actions ---
export async function createCustomerAction(data: Omit<Customer, "id" | "createdAt">) {
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
  await deleteCustomer(id);
  revalidatePath("/customers");
  revalidatePath("/invoices/new");
  return { success: true };
}

// --- Product Actions ---
export async function createProductAction(data: Omit<Product, "id">) {
  const id = uuidv4();
  const product: Product = {
    ...data,
    id,
  };

  const validated = ProductSchema.parse(product);
  await saveProduct(validated);

  revalidatePath("/products");
  revalidatePath("/invoices/new");
  return { success: true, product: validated };
}

export async function updateProductAction(id: string, data: Omit<Product, "id">) {
  const product: Product = {
    ...data,
    id,
  };

  const validated = ProductSchema.parse(product);
  await saveProduct(validated);

  revalidatePath("/products");
  return { success: true, product: validated };
}

export async function deleteProductAction(id: string) {
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
          prod.stock = (prod.stock ?? 0) - item.quantity;
          await saveProduct(prod);
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
          prod.stock = (prod.stock ?? 0) + item.quantity;
          await saveProduct(prod);
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
        prod.stock = (prod.stock ?? 0) - item.quantity;
        await saveProduct(prod);
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
