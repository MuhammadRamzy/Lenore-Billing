import { getProducts, getCompany, getStockLogs } from "@/lib/db";
import ProductsList from "@/components/ProductsList";

export const revalidate = 0; // Fresh load on request

export default async function ProductsPage() {
  const products = await getProducts();
  const company = await getCompany();
  const stockLogs = await getStockLogs();

  // Sort products: alphabetically by name
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ProductsList
      initialProducts={sortedProducts}
      company={company}
      lowStockLimit={company.lowStockLimit ?? 5}
      initialStockLogs={stockLogs}
    />
  );
}
