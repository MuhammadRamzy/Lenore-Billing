import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { Company, Customer, Product, Invoice, Counters, Purchase, Expense, StockLog } from "./types";

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
    const docRef = doc(db, "settings", "company");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
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
  await setDoc(doc(db, "settings", "company"), company);
  cachedCompany = company;
  lastCompanyFetch = Date.now();
}

// Customers DB Operations
export async function getCustomers(): Promise<Customer[]> {
  if (cachedCustomers && isCacheValid(lastCustomersFetch)) {
    return cachedCustomers;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
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
  await setDoc(doc(db, "customers", customer.id), customer);
  // Clear cache to force next load to be fresh
  cachedCustomers = null;
  lastCustomersFetch = 0;
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, "customers", id));
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
    const querySnapshot = await getDocs(collection(db, "products"));
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
  await setDoc(doc(db, "products", product.id), product);
  // Clear cache to force next load to be fresh
  cachedProducts = null;
  lastProductsFetch = 0;
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
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
    const querySnapshot = await getDocs(collection(db, "invoices"));
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
  await setDoc(doc(db, "invoices", invoice.id), invoice);
  // Clear cache to force next load to be fresh
  cachedInvoices = null;
  lastInvoicesFetch = 0;
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, "invoices", id));
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
    const docRef = doc(db, "settings", "counters");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
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
  await setDoc(doc(db, "settings", "counters"), counters);
  cachedCounters = counters;
  lastCountersFetch = Date.now();
}

// Purchases DB Operations
export async function getPurchases(): Promise<Purchase[]> {
  if (cachedPurchases && isCacheValid(lastPurchasesFetch)) {
    return cachedPurchases;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "purchases"));
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
  await setDoc(doc(db, "purchases", purchase.id), purchase);
  // Clear cache to force next load to be fresh
  cachedPurchases = null;
  lastPurchasesFetch = 0;
}

export async function deletePurchase(id: string): Promise<void> {
  await deleteDoc(doc(db, "purchases", id));
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
    const querySnapshot = await getDocs(collection(db, "expenses"));
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
  await setDoc(doc(db, "expenses", expense.id), expense);
  cachedExpenses = null;
  lastExpensesFetch = 0;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
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
    const querySnapshot = await getDocs(collection(db, "stockLogs"));
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
  await setDoc(doc(db, "stockLogs", log.id), log);
  cachedStockLogs = null;
  lastStockLogsFetch = 0;
}
