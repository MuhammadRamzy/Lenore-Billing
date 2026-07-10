import { z } from "zod";

// Zod schemas for validation
export const BankSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountNo: z.string().min(1, "Account number is required"),
  ifsc: z.string().min(1, "IFSC code is required"),
  branch: z.string().min(1, "Branch name is required"),
});

export const CompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tagline: z.string().optional().nullable(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  stateCode: z.string().min(2, "State code must be 2 digits"),
  pincode: z.string().min(6, "Pincode must be 6 digits"),
  gstin: z.string().optional().nullable(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  bank: BankSchema,
  logoUrl: z.string().optional().nullable(),
  lowStockLimit: z.number().int().nonnegative().default(5),
  invoicePrefix: z.string().default("INV"),
  termsAndConditions: z.string().optional().nullable().or(z.literal("")),
  discountCustomer: z.number().nonnegative().default(0),
  discountSales: z.number().nonnegative().default(0),
  discountWholesale: z.number().nonnegative().default(0),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Customer name is required"),
  address: z.string().optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable().or(z.literal("")),
  state: z.string().optional().nullable().or(z.literal("")),
  stateCode: z.string().optional().nullable().or(z.literal("")),
  pincode: z.string().optional().nullable().or(z.literal("")),
  gstin: z.string().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable().or(z.literal("")),
  email: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  code: z.string().optional().nullable(),
  name: z.string().min(1, "Product name is required"),
  hsnCode: z.string().optional().nullable(),
  unit: z.string().min(1, "Unit (e.g. pcs, box) is required"),
  defaultRate: z.number().nonnegative("Rate must be positive"),
  defaultGstPercent: z.number().min(0).max(100),
  stock: z.number().int().nonnegative("Stock cannot be negative").default(0),
});

export const InvoiceMetaSchema = z.object({
  deliveryNote: z.string().optional().nullable(),
  buyersOrderNo: z.string().optional().nullable(),
  buyersOrderDate: z.string().optional().nullable(),
  dispatchDocNo: z.string().optional().nullable(),
  dispatchedThrough: z.string().optional().nullable(),
  paymentTerms: z.string().min(1, "Payment terms required"),
  destination: z.string().optional().nullable(),
  termsOfDelivery: z.string().optional().nullable(),
  showLogo: z.boolean().optional(),
  showBankDetails: z.boolean().optional(),
  showDeclaration: z.boolean().optional(),
  showTerms: z.boolean().optional(),
});

export const LineItemSchema = z.object({
  slNo: z.number().int().positive(),
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  hsnCode: z.string().optional().nullable(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  rate: z.number().nonnegative("Rate must be positive"),
  discountPercent: z.number().min(0).max(100),
  gstPercent: z.number().min(0).max(100),
  taxableValue: z.number(),
  cgstAmount: z.number(),
  sgstAmount: z.number(),
  igstAmount: z.number(),
  amount: z.number(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNo: z.string(),
  financialYear: z.string(),
  sequence: z.number().int().positive(),
  invoiceDate: z.string(),
  isGstInvoice: z.boolean(),
  customerId: z.string().uuid(),
  customerSnapshot: z.object({
    name: z.string(),
    address: z.string(),
    gstin: z.string().optional().nullable(),
    state: z.string(),
    stateCode: z.string(),
  }),
  meta: InvoiceMetaSchema,
  lineItems: z.array(LineItemSchema).min(1, "At least one line item is required"),
  freight: z.number().nonnegative(),
  subtotal: z.number(),
  totalDiscount: z.number(),
  taxableValueTotal: z.number(),
  cgstTotal: z.number(),
  sgstTotal: z.number(),
  igstTotal: z.number(),
  roundOff: z.number(),
  grandTotal: z.number(),
  amountInWords: z.string(),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  remarks: z.string().optional().nullable(),
  type: z.enum(["invoice", "quotation"]).default("invoice"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PurchaseSchema = z.object({
  id: z.string().uuid(),
  purchaseNo: z.string(),
  supplierBillNo: z.string().optional().nullable().or(z.literal("")),
  purchaseDate: z.string(),
  isGstPurchase: z.boolean(),
  supplierName: z.string().min(1, "Supplier name is required"),
  supplierGstin: z.string().optional().nullable().or(z.literal("")),
  supplierAddress: z.string().optional().nullable().or(z.literal("")),
  lineItems: z.array(LineItemSchema).min(1, "At least one line item is required"),
  freight: z.number().nonnegative(),
  subtotal: z.number(),
  totalDiscount: z.number().default(0),
  taxableValueTotal: z.number(),
  cgstTotal: z.number(),
  sgstTotal: z.number(),
  igstTotal: z.number(),
  roundOff: z.number(),
  grandTotal: z.number(),
  status: z.enum(["pending", "paid"]),
  remarks: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CountersSchema = z.object({
  invoiceCounters: z.record(z.string(), z.number()),
  quotationCounters: z.record(z.string(), z.number()).default({}),
  purchaseCounters: z.record(z.string(), z.number()).default({}),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  category: z.enum(["rent", "utilities", "salaries", "marketing", "freight", "travel", "miscellaneous"]),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMode: z.enum(["cash", "bank", "card", "upi", "other"]),
  description: z.string().min(1, "Description is required"),
  referenceNo: z.string().optional().nullable().or(z.literal("")),
  gstin: z.string().optional().nullable().or(z.literal("")),
  gstAmount: z.number().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StockLogSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  date: z.string(),
  type: z.enum(["inward", "outward", "adjustment"]),
  quantity: z.number().int(), // Positive for inward (purchase), negative for outward (sale), positive/negative for manual adjustments
  previousStock: z.number().int().nonnegative(),
  newStock: z.number().int().nonnegative(),
  referenceId: z.string(), // Invoice ID, Purchase ID, or "manual"
  referenceNo: z.string(), // Invoice No, Purchase No, or description
  notes: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
});

// TypeScript type inference
export type Bank = z.infer<typeof BankSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type InvoiceMeta = z.infer<typeof InvoiceMetaSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Purchase = z.infer<typeof PurchaseSchema>;
export type Counters = z.infer<typeof CountersSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type StockLog = z.infer<typeof StockLogSchema>;
