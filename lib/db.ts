import { db } from "./firebase";
import { Company, Customer, Product, Invoice, Counters, Purchase, Expense, StockLog, Trip } from "./types";

// In-Memory Server Cache for Firestore Reads Optimization
let cachedCompany: Company | null = null;
let cachedCustomers: Customer[] | null = null;
let cachedProducts: Product[] | null = null;
let cachedInvoices: Invoice[] | null = null;
let cachedCounters: Counters | null = null;
let cachedPurchases: Purchase[] | null = null;

let lastCompanyFetch = 0;
let lastCustomersFetch = 0;
let lastProductsFetch = 0;
let lastInvoicesFetch = 0;
let lastCountersFetch = 0;
let lastPurchasesFetch = 0;

const CACHE_TTL = 300000; // 5 minutes cache TTL (saves Firestore read costs)

// Helper to check if cache is valid
const isCacheValid = (lastFetch: number) => {
  return Date.now() - lastFetch < CACHE_TTL;
};

// Company DB Operations
export async function getCompany(): Promise<Company> {
  const defaultCompany: Company = {
    name: "Apex Bath Fittings",
    tagline: "Premium Bath Fittings & Accessories",
    address: "Gala No. 12, Industrial Area, Sector 2",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "400001",
    gstin: "27AAAAA1111A1Z1",
    phone: "9876543210",
    email: "info@apexbath.com",
    bank: {
      bankName: "HDFC Bank",
      accountNo: "50100200300400",
      ifsc: "HDFC0000012",
      branch: "Fort Branch, Mumbai",
    },
    logoUrl: null,
    lowStockLimit: 5,
    invoicePrefix: "INV",
    termsAndConditions: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods once sold will not be taken back.",
    discountCustomer: 5,
    discountSales: 10,
    discountWholesale: 15,
  };

  if (cachedCompany && isCacheValid(lastCompanyFetch)) {
    return cachedCompany;
  }

  try {
    const docSnap = await db.collection("settings").doc("company").get();
    const data = docSnap.data();
    if (data) {
      cachedCompany = {
        ...defaultCompany,
        ...data,
        discountCustomer: data.discountCustomer ?? 0,
        discountSales: data.discountSales ?? 0,
        discountWholesale: data.discountWholesale ?? 0,
      } as Company;
      lastCompanyFetch = Date.now();
      return cachedCompany;
    }
  } catch (error) {
    console.error("Error reading company from Firestore:", error);
  }
  return defaultCompany;
}

export async function saveCompany(company: Company): Promise<void> {
  await db.collection("settings").doc("company").set(company);
  cachedCompany = company;
  lastCompanyFetch = Date.now();
}

// Customers DB Operations
export async function getCustomers(): Promise<Customer[]> {
  if (cachedCustomers && isCacheValid(lastCustomersFetch)) {
    return cachedCustomers;
  }

  try {
    const querySnapshot = await db.collection("customers").get();
    const list: Customer[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Customer);
    });

    // Sort by creation date to maintain consistent UI sorting
    const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    cachedCustomers = sorted;
    lastCustomersFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading customers from Firestore:", error);
    return cachedCustomers || [];
  }
}

export async function saveCustomer(customer: Customer): Promise<void> {
  await db.collection("customers").doc(customer.id).set(customer);
  // Clear cache to force next load to be fresh
  cachedCustomers = null;
  lastCustomersFetch = 0;
}

export async function deleteCustomer(id: string): Promise<void> {
  await db.collection("customers").doc(id).delete();
  // Clear cache to force next load to be fresh
  cachedCustomers = null;
  lastCustomersFetch = 0;
}

// Products DB Operations
export async function getProducts(): Promise<Product[]> {
  if (cachedProducts && isCacheValid(lastProductsFetch)) {
    return cachedProducts;
  }

  try {
    const querySnapshot = await db.collection("products").get();
    const list: Product[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Product);
    });

    const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
    cachedProducts = sorted;
    lastProductsFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading products from Firestore:", error);
    return cachedProducts || [];
  }
}

export async function saveProduct(product: Product): Promise<void> {
  await db.collection("products").doc(product.id).set(product);
  // Clear cache to force next load to be fresh
  cachedProducts = null;
  lastProductsFetch = 0;
}

export async function deleteProduct(id: string): Promise<void> {
  await db.collection("products").doc(id).delete();
  // Clear cache to force next load to be fresh
  cachedProducts = null;
  lastProductsFetch = 0;
}

// Invoices DB Operations
export async function getInvoices(): Promise<Invoice[]> {
  if (cachedInvoices && isCacheValid(lastInvoicesFetch)) {
    return cachedInvoices;
  }

  try {
    const querySnapshot = await db.collection("invoices").get();
    const list: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Invoice);
    });

    const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    cachedInvoices = sorted;
    lastInvoicesFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading invoices from Firestore:", error);
    return cachedInvoices || [];
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await db.collection("invoices").doc(invoice.id).set(invoice);
  // Clear cache to force next load to be fresh
  cachedInvoices = null;
  lastInvoicesFetch = 0;
}

export async function deleteInvoice(id: string): Promise<void> {
  await db.collection("invoices").doc(id).delete();
  // Clear cache to force next load to be fresh
  cachedInvoices = null;
  lastInvoicesFetch = 0;
}

// Counters Operations
export async function getCounters(): Promise<Counters> {
  const defaultCounters: Counters = {
    invoiceCounters: {},
    quotationCounters: {},
    purchaseCounters: {},
  };

  if (cachedCounters && isCacheValid(lastCountersFetch)) {
    return cachedCounters;
  }

  try {
    const docSnap = await db.collection("settings").doc("counters").get();
    const data = docSnap.data();
    if (data) {
      cachedCounters = {
        invoiceCounters: data.invoiceCounters || {},
        quotationCounters: data.quotationCounters || {},
        purchaseCounters: data.purchaseCounters || {},
      };
      lastCountersFetch = Date.now();
      return cachedCounters;
    }
  } catch (error) {
    console.error("Error reading counters from Firestore:", error);
  }
  return defaultCounters;
}

export async function saveCounters(counters: Counters): Promise<void> {
  await db.collection("settings").doc("counters").set(counters);
  cachedCounters = counters;
  lastCountersFetch = Date.now();
}

// Purchases DB Operations
export async function getPurchases(): Promise<Purchase[]> {
  if (cachedPurchases && isCacheValid(lastPurchasesFetch)) {
    return cachedPurchases;
  }

  try {
    const querySnapshot = await db.collection("purchases").get();
    const list: Purchase[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Purchase);
    });

    const sorted = list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    cachedPurchases = sorted;
    lastPurchasesFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading purchases from Firestore:", error);
    return cachedPurchases || [];
  }
}

export async function savePurchase(purchase: Purchase): Promise<void> {
  await db.collection("purchases").doc(purchase.id).set(purchase);
  // Clear cache to force next load to be fresh
  cachedPurchases = null;
  lastPurchasesFetch = 0;
}

export async function deletePurchase(id: string): Promise<void> {
  await db.collection("purchases").doc(id).delete();
  // Clear cache to force next load to be fresh
  cachedPurchases = null;
  lastPurchasesFetch = 0;
}

// Expenses DB Operations
let cachedExpenses: Expense[] | null = null;
let lastExpensesFetch = 0;

export async function getExpenses(): Promise<Expense[]> {
  if (cachedExpenses && isCacheValid(lastExpensesFetch)) {
    return cachedExpenses;
  }

  try {
    const querySnapshot = await db.collection("expenses").get();
    const list: Expense[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Expense);
    });

    const sorted = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    cachedExpenses = sorted;
    lastExpensesFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading expenses from Firestore:", error);
    return cachedExpenses || [];
  }
}

export async function saveExpense(expense: Expense): Promise<void> {
  await db.collection("expenses").doc(expense.id).set(expense);
  cachedExpenses = null;
  lastExpensesFetch = 0;
}

export async function deleteExpense(id: string): Promise<void> {
  await db.collection("expenses").doc(id).delete();
  cachedExpenses = null;
  lastExpensesFetch = 0;
}

// StockLogs DB Operations
let cachedStockLogs: StockLog[] | null = null;
let lastStockLogsFetch = 0;

export async function getStockLogs(productId?: string): Promise<StockLog[]> {
  if (cachedStockLogs && isCacheValid(lastStockLogsFetch)) {
    const logs = cachedStockLogs;
    return productId ? logs.filter((log) => log.productId === productId) : logs;
  }

  try {
    const querySnapshot = await db.collection("stockLogs").get();
    const list: StockLog[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as StockLog);
    });

    const sorted = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    cachedStockLogs = sorted;
    lastStockLogsFetch = Date.now();
    return productId ? sorted.filter((log) => log.productId === productId) : sorted;
  } catch (error) {
    console.error("Error reading stock logs from Firestore:", error);
    const fallback = cachedStockLogs || [];
    return productId ? fallback.filter((log) => log.productId === productId) : fallback;
  }
}

export async function saveStockLog(log: StockLog): Promise<void> {
  await db.collection("stockLogs").doc(log.id).set(log);
  cachedStockLogs = null;
  lastStockLogsFetch = 0;
}

// Trips DB Operations
let cachedTrips: Trip[] | null = null;
let lastTripsFetch = 0;

export async function getTrips(): Promise<Trip[]> {
  if (cachedTrips && isCacheValid(lastTripsFetch)) {
    return cachedTrips;
  }

  try {
    const querySnapshot = await db.collection("trips").get();
    const list: Trip[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Trip);
    });

    const sorted = list.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    cachedTrips = sorted;
    lastTripsFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading trips from Firestore:", error);
    return cachedTrips || [];
  }
}

export async function saveTrip(trip: Trip): Promise<void> {
  await db.collection("trips").doc(trip.id).set(trip);
  cachedTrips = null;
  lastTripsFetch = 0;
}

export async function deleteTrip(id: string): Promise<void> {
  await db.collection("trips").doc(id).delete();
  cachedTrips = null;
  lastTripsFetch = 0;
}

// Authentication Password Hash Operations
export async function getPasswordHash(): Promise<string> {
  try {
    const docSnap = await db.collection("settings").doc("auth").get();
    const data = docSnap.data();
    if (data?.passwordHash) {
      return data.passwordHash;
    }
  } catch (error) {
    console.error("Error reading password hash from Firestore:", error);
  }
  // Default fallback password hash for "admin123"
  const defaultHash = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
  return defaultHash;
}

export async function savePasswordHash(hash: string): Promise<void> {
  await db.collection("settings").doc("auth").set({ passwordHash: hash });
}
