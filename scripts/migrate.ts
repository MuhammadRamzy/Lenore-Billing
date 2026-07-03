import { loadEnvConfig } from "@next/env";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

async function runMigration() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("Error: FIREBASE_PROJECT_ID environment variable is missing.");
    console.error("Please create a .env.local file with your Firebase configuration first.");
    process.exit(1);
  }

  // Dynamically import DB functions after env configuration is loaded
  const { saveCompany, saveCustomer, saveProduct, saveInvoice, saveCounters } = await import("../lib/db");
  console.log("Starting migration of local data to Firebase Firestore...");

  const dataDir = path.join(process.cwd(), "data");

  // 1. Migrate Company Settings
  const companyPath = path.join(dataDir, "company.json");
  if (fs.existsSync(companyPath)) {
    console.log("Migrating company settings...");
    const company = JSON.parse(fs.readFileSync(companyPath, "utf8"));
    await saveCompany(company);
    console.log("Company settings migrated.");
  } else {
    console.log("No company.json found, skipping.");
  }

  // 2. Migrate Counters
  const countersPath = path.join(dataDir, "counters.json");
  if (fs.existsSync(countersPath)) {
    console.log("Migrating counters...");
    const counters = JSON.parse(fs.readFileSync(countersPath, "utf8"));
    await saveCounters(counters);
    console.log("Counters migrated.");
  } else {
    console.log("No counters.json found, skipping.");
  }

  // 3. Migrate Customers
  const customersPath = path.join(dataDir, "customers.json");
  if (fs.existsSync(customersPath)) {
    console.log("Migrating customers...");
    const customers = JSON.parse(fs.readFileSync(customersPath, "utf8"));
    for (const customer of customers) {
      console.log(`- Uploading customer: ${customer.name}`);
      await saveCustomer(customer);
    }
    console.log(`Migrated ${customers.length} customers.`);
  } else {
    console.log("No customers.json found, skipping.");
  }

  // 4. Migrate Products
  const productsPath = path.join(dataDir, "products.json");
  if (fs.existsSync(productsPath)) {
    console.log("Migrating products...");
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
    for (const product of products) {
      console.log(`- Uploading product: ${product.name}`);
      await saveProduct(product);
    }
    console.log(`Migrated ${products.length} products.`);
  } else {
    console.log("No products.json found, skipping.");
  }

  // 5. Migrate Invoices
  const invoicesPath = path.join(dataDir, "invoices.json");
  if (fs.existsSync(invoicesPath)) {
    console.log("Migrating invoices...");
    const invoices = JSON.parse(fs.readFileSync(invoicesPath, "utf8"));
    for (const invoice of invoices) {
      console.log(`- Uploading invoice: ${invoice.invoiceNo || invoice.id}`);
      await saveInvoice(invoice);
    }
    console.log(`Migrated ${invoices.length} invoices.`);
  } else {
    console.log("No invoices.json found, skipping.");
  }

  console.log("\nMigration completed successfully! All data has been uploaded to Firebase Firestore.");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Migration failed with error:", error);
  process.exit(1);
});
