import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { Company, Customer, Product, Invoice, Counters } from "./types";

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
  };
  try {
    const docRef = doc(db, "settings", "company");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Company;
    }
  } catch (error) {
    console.error("Error reading company from Firestore:", error);
  }
  return defaultCompany;
}

export async function saveCompany(company: Company): Promise<void> {
  await setDoc(doc(db, "settings", "company"), company);
}

// Customers DB Operations
export async function getCustomers(): Promise<Customer[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
    const list: Customer[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Customer);
    });
    // Sort by name or creation date to maintain consistent UI sorting
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error reading customers from Firestore:", error);
    return [];
  }
}

export async function saveCustomer(customer: Customer): Promise<void> {
  await setDoc(doc(db, "customers", customer.id), customer);
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, "customers", id));
}

// Products DB Operations
export async function getProducts(): Promise<Product[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const list: Product[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Product);
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error reading products from Firestore:", error);
    return [];
  }
}

export async function saveProduct(product: Product): Promise<void> {
  await setDoc(doc(db, "products", product.id), product);
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}

// Invoices DB Operations
export async function getInvoices(): Promise<Invoice[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "invoices"));
    const list: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Invoice);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error reading invoices from Firestore:", error);
    return [];
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await setDoc(doc(db, "invoices", invoice.id), invoice);
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, "invoices", id));
}

// Counters Operations
export async function getCounters(): Promise<Counters> {
  const defaultCounters: Counters = {
    invoiceCounters: {},
    quotationCounters: {},
  };
  try {
    const docRef = doc(db, "settings", "counters");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        invoiceCounters: data.invoiceCounters || {},
        quotationCounters: data.quotationCounters || {},
      };
    }
  } catch (error) {
    console.error("Error reading counters from Firestore:", error);
  }
  return defaultCounters;
}

export async function saveCounters(counters: Counters): Promise<void> {
  await setDoc(doc(db, "settings", "counters"), counters);
}
