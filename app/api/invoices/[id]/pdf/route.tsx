import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { getInvoices, getCompany } from "@/lib/db";
import { isAuthenticated } from "@/lib/api-auth";
import path from "path";

export const revalidate = 0;

// Create styles for A4 Tax Invoice
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 12,
    marginBottom: 8,
  },
  companyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "60%",
  },
  companyLogo: {
    width: 48,
    height: 48,
    marginRight: 8,
    objectFit: "contain",
  },
  companyDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  companyTagline: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#64748b",
    marginBottom: 4,
  },
  companyText: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.3,
  },
  companyGstin: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 2,
  },
  invoiceTitleBlock: {
    width: "40%",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  invoiceTitleBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  invoiceMetaText: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right",
    lineHeight: 1.3,
  },
  invoiceMetaVal: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  // Dispatch Block Grid
  dispatchGrid: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
    marginBottom: 8,
  },
  dispatchCol: {
    flex: 1,
    paddingRight: 8,
  },
  dispatchLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  dispatchVal: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },

  // Bill To Block
  billingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 8,
    marginBottom: 10,
  },
  billToBlock: {
    width: "60%",
  },
  billToLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clientName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  clientText: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.2,
  },
  destinationBlock: {
    width: "40%",
    alignItems: "flex-end",
  },

  // Table Styles
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    minHeight: 18,
  },
  tableHeaderCol: {
    padding: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#475569",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    alignItems: "center",
    minHeight: 18,
  },
  tableRowCol: {
    padding: 3,
    fontSize: 8,
    color: "#334155",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
  },

  // Totals Grid
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryLeft: {
    width: "55%",
  },
  summaryRight: {
    width: "40%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 6,
  },
  wordsLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  wordsText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    lineHeight: 1.3,
    marginBottom: 10,
  },
  bankContainer: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 6,
  },
  bankTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bankRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bankLabel: {
    width: "40%",
    fontSize: 7,
    color: "#64748b",
  },
  bankVal: {
    width: "60%",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },

  // Calculations Panel Right
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 8,
  },
  summaryLabel: {
    color: "#64748b",
  },
  summaryVal: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    textAlign: "right",
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 4,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  summaryTotalVal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "right",
  },

  // Signature Block
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  declarationBlock: {
    width: "55%",
  },
  decTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  decText: {
    fontSize: 7,
    color: "#94a3b8",
    lineHeight: 1.3,
  },
  signBlock: {
    width: "40%",
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 50,
  },
  signLabel: {
    fontSize: 7,
    color: "#64748b",
  },
  companySignName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  signLine: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 2,
    marginTop: 8,
    width: "120px",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 4,
    textAlign: "center",
    fontSize: 7,
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

interface InvoiceDocumentProps {
  invoice: any;
  company: any;
  logoPath?: string;
}

const InvoiceDocument = ({ invoice, company, logoPath }: InvoiceDocumentProps) => {
  const isInterState = invoice.customerSnapshot.stateCode !== company.stateCode;
  const isGstInvoice = invoice.isGstInvoice;

  // Format currency helpers for PDF text
  const formatPdfCurrency = (amount: number) => {
    return `Rs. ${amount.toFixed(2)}`;
  };

  const hasDispatchDetails = !!(
    invoice.meta.deliveryNote ||
    invoice.meta.buyersOrderNo ||
    invoice.meta.dispatchDocNo ||
    invoice.meta.dispatchedThrough
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Block */}
        <View style={styles.headerContainer}>
          <View style={styles.companyHeaderRow}>
            {logoPath && invoice.meta.showLogo !== false ? (
              <Image src={logoPath} style={styles.companyLogo} />
            ) : null}
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{company.name}</Text>
              {company.tagline && <Text style={styles.companyTagline}>{company.tagline}</Text>}
              <Text style={styles.companyText}>{company.address}</Text>
              <Text style={styles.companyText}>
                {company.city} - {company.pincode}, {company.state}
              </Text>
              <Text style={styles.companyText}>
                Phone: {company.phone} | Email: {company.email}
              </Text>
              {company.gstin && (
                <Text style={styles.companyGstin}>GSTIN: {company.gstin}</Text>
              )}
            </View>
          </View>
          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.invoiceTitleBadge}>
              {isGstInvoice ? "Tax Invoice" : "Invoice / Bill"}
            </Text>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.invoiceMetaText}>
                Invoice No: <Text style={styles.invoiceMetaVal}>{invoice.invoiceNo}</Text>
              </Text>
              <Text style={styles.invoiceMetaText}>
                Date: <Text style={styles.invoiceMetaVal}>
                  {new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </Text>
              <Text style={styles.invoiceMetaText}>
                Terms: <Text style={styles.invoiceMetaVal}>{invoice.meta.paymentTerms}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Dispatch Grid */}
        {hasDispatchDetails && invoice.meta.showTerms !== false && (
          <View style={styles.dispatchGrid}>
            {invoice.meta.deliveryNote ? (
              <View style={styles.dispatchCol}>
                <Text style={styles.dispatchLabel}>Delivery Note</Text>
                <Text style={styles.dispatchVal}>{invoice.meta.deliveryNote}</Text>
              </View>
            ) : null}
            {invoice.meta.buyersOrderNo ? (
              <View style={styles.dispatchCol}>
                <Text style={styles.dispatchLabel}>Buyer's Order No & Date</Text>
                <Text style={styles.dispatchVal}>
                  {invoice.meta.buyersOrderNo}
                  {invoice.meta.buyersOrderDate
                    ? ` dtd. ${new Date(invoice.meta.buyersOrderDate).toLocaleDateString("en-IN")}`
                    : ""}
                </Text>
              </View>
            ) : null}
            {invoice.meta.dispatchDocNo ? (
              <View style={styles.dispatchCol}>
                <Text style={styles.dispatchLabel}>Dispatch Doc No</Text>
                <Text style={styles.dispatchVal}>{invoice.meta.dispatchDocNo}</Text>
              </View>
            ) : null}
            {invoice.meta.dispatchedThrough ? (
              <View style={styles.dispatchCol}>
                <Text style={styles.dispatchLabel}>Dispatched Through</Text>
                <Text style={styles.dispatchVal}>{invoice.meta.dispatchedThrough}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Bill To Block */}
        <View style={styles.billingContainer}>
          <View style={styles.billToBlock}>
            <Text style={styles.billToLabel}>Bill To (Buyer)</Text>
            <Text style={styles.clientName}>{invoice.customerSnapshot.name}</Text>
            <Text style={styles.clientText}>{invoice.customerSnapshot.address}</Text>
            <Text style={styles.clientText}>
              State: {invoice.customerSnapshot.state} (Code: {invoice.customerSnapshot.stateCode})
            </Text>
            {invoice.customerSnapshot.gstin && (
              <Text style={[styles.clientText, { fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 2 }]}>
                GSTIN: {invoice.customerSnapshot.gstin}
              </Text>
            )}
          </View>
          {(invoice.meta.destination || invoice.meta.termsOfDelivery) ? (
            <View style={styles.destinationBlock}>
              <Text style={styles.billToLabel}>Shipment / Destination</Text>
              {invoice.meta.destination ? (
                <Text style={styles.clientName}>{invoice.meta.destination}</Text>
              ) : null}
              {invoice.meta.termsOfDelivery ? (
                <Text style={[styles.clientText, { textAlign: "right", marginTop: 2 }]}>
                  Terms of Delivery: {invoice.meta.termsOfDelivery}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.destinationBlock} />
          )}
        </View>

        {/* Table layout */}
        <View style={styles.table}>
          {/* Table Header - fixed parameter added to repeat on multiple pages */}
          <View style={styles.tableHeader} fixed>
            <View style={[styles.tableHeaderCol, { width: "5%", textAlign: "center" }]}>
              <Text>Sl</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: isGstInvoice ? "35%" : "55%" }]}>
              <Text>Description of Goods</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "center" }]}>
              <Text>HSN/SAC</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "8%", textAlign: "right" }]}>
              <Text>Qty</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "7%", textAlign: "center" }]}>
              <Text>Unit</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "right" }]}>
              <Text>Rate</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "right" }]}>
              <Text>Taxable</Text>
            </View>
            {isGstInvoice && (
              <>
                {!isInterState ? (
                  <>
                    <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "right" }]}>
                      <Text>CGST</Text>
                    </View>
                    <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "right" }]}>
                      <Text>SGST</Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.tableHeaderCol, { width: "15%", textAlign: "right" }]}>
                    <Text>IGST</Text>
                  </View>
                )}
              </>
            )}
            <View style={[styles.tableHeaderCol, { width: "15%", textAlign: "right", borderRightWidth: 0 }]}>
              <Text>Amount</Text>
            </View>
          </View>

          {/* Table Rows */}
          {invoice.lineItems.map((item: any, idx: number) => (
            <View style={styles.tableRow} key={idx}>
              <View style={[styles.tableRowCol, { width: "5%", textAlign: "center" }]}>
                <Text>{item.slNo}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: isGstInvoice ? "35%" : "55%", fontFamily: "Helvetica-Bold", color: "#0f172a" }]}>
                <Text>{item.description}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "10%", textAlign: "center" }]}>
                <Text>{item.hsnCode || "-"}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "8%", textAlign: "right" }]}>
                <Text>{item.quantity}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "7%", textAlign: "center", textTransform: "uppercase", fontSize: 6 }]}>
                <Text>{item.unit}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "10%", textAlign: "right" }]}>
                <Text>{item.rate.toFixed(2)}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "10%", textAlign: "right" }]}>
                <Text>{item.taxableValue.toFixed(2)}</Text>
              </View>
              {isGstInvoice && (
                <>
                  {!isInterState ? (
                    <>
                      <View style={[styles.tableRowCol, { width: "10%", textAlign: "right" }]}>
                        <Text>{item.cgstAmount.toFixed(2)}</Text>
                        <Text style={{ fontSize: 5, color: "#94a3b8" }}>
                          ({(item.gstPercent / 2).toFixed(1)}%)
                        </Text>
                      </View>
                      <View style={[styles.tableRowCol, { width: "10%", textAlign: "right" }]}>
                        <Text>{item.sgstAmount.toFixed(2)}</Text>
                        <Text style={{ fontSize: 5, color: "#94a3b8" }}>
                          ({(item.gstPercent / 2).toFixed(1)}%)
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={[styles.tableRowCol, { width: "15%", textAlign: "right" }]}>
                      <Text>{item.igstAmount.toFixed(2)}</Text>
                      <Text style={{ fontSize: 5, color: "#94a3b8" }}>({item.gstPercent}%)</Text>
                    </View>
                  )}
                </>
              )}
              <View style={[styles.tableRowCol, { width: "15%", textAlign: "right", borderRightWidth: 0, fontFamily: "Helvetica-Bold" }]}>
                <Text>{item.amount.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary Block - wrap={false} prevents split across pages */}
        <View style={styles.summaryContainer} wrap={false}>
          {/* Left panel: Bank + Words */}
          <View style={styles.summaryLeft}>
            <Text style={styles.wordsLabel}>Amount Chargeable (in words)</Text>
            <Text style={styles.wordsText}>{invoice.amountInWords}</Text>

            {invoice.meta.showBankDetails !== false ? (
              <View style={styles.bankContainer}>
                <Text style={styles.bankTitle}>Company Bank Account Details</Text>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Bank Name:</Text>
                  <Text style={styles.bankVal}>{company.bank.bankName}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>A/C Number:</Text>
                  <Text style={styles.bankVal}>{company.bank.accountNo}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>IFSC Code:</Text>
                  <Text style={styles.bankVal}>{company.bank.ifsc}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Branch Name:</Text>
                  <Text style={styles.bankVal}>{company.bank.branch}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Right panel: Calculations math */}
          <View style={styles.summaryRight}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal (Goods Value):</Text>
              <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.subtotal)}</Text>
            </View>
            {invoice.totalDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Discount:</Text>
                <Text style={[styles.summaryVal, { color: "#b91c1c" }]}>
                  -{formatPdfCurrency(invoice.totalDiscount)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 2 }]}>
              <Text style={[styles.summaryLabel, { fontFamily: "Helvetica-Bold", color: "#334155" }]}>
                Taxable Value Total:
              </Text>
              <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.taxableValueTotal)}</Text>
            </View>

            {isGstInvoice && (
              <View style={{ marginTop: 2, paddingLeft: 4, borderLeftWidth: 1, borderLeftColor: "#cbd5e1" }}>
                {!isInterState ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>CGST Total:</Text>
                      <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.cgstTotal)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>SGST Total:</Text>
                      <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.sgstTotal)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>IGST Total:</Text>
                    <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.igstTotal)}</Text>
                  </View>
                )}
              </View>
            )}

            {invoice.freight > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Freight Charges:</Text>
                <Text style={styles.summaryVal}>{formatPdfCurrency(invoice.freight)}</Text>
              </View>
            )}

            {invoice.roundOff !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round-off:</Text>
                <Text style={styles.summaryVal}>
                  {invoice.roundOff > 0 ? "+" : ""}
                  {invoice.roundOff.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Grand Total:</Text>
              <Text style={styles.summaryTotalVal}>{formatPdfCurrency(invoice.grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Signatures & Declarations - wrap={false} prevents split */}
        <View style={styles.signatureContainer} wrap={false}>
          <View style={styles.declarationBlock}>
            {invoice.meta.showDeclaration !== false ? (
              <>
                <Text style={styles.decTitle}>Declaration</Text>
                <Text style={styles.decText}>
                  We declare that this invoice shows the actual price of the goods described and that all
                  particulars are true and correct. Goods once sold will not be taken back.
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.signBlock}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.signLabel}>for</Text>
              <Text style={styles.companySignName}>{company.name}</Text>
            </View>
            <Text style={styles.signLine}>Authorised Signatory</Text>
          </View>
        </View>

        {/* Dynamic page-numbered and time-watermarked footer repeated on every page */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}  |  Printed on: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}  |  This is a computer generated invoice and requires no physical signature.`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoices = await getInvoices();
    const invoice = invoices.find((inv) => inv.id === id);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const company = await getCompany();
    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // Render react-pdf document to stream
    const doc = <InvoiceDocument invoice={invoice} company={company} logoPath={logoPath} />;
    const stream = await pdf(doc).toBuffer();

    // Return the readable stream directly to browser as attachment download
    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice_${invoice.invoiceNo.replace("/", "_")}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
