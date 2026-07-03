import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, quantities, config, custom, toggles } = body;

    const paperWidth = config.pageSize === "A4"
      ? (config.orientation === "portrait" ? 210 : 297)
      : (config.orientation === "portrait" ? 297 : 420);
    const paperHeight = config.pageSize === "A4"
      ? (config.orientation === "portrait" ? 297 : 210)
      : (config.orientation === "portrait" ? 420 : 297);

    const mmToPoints = (mm: number) => mm * 2.834645;

    // Load logo image as Base64 Data URL
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    let logoDataUrl = "";
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch (logoErr) {
      console.error("Failed to load logo for stickers:", logoErr);
    }

    // Compile active stickers to print
    const items: any[] = [];
    for (const prod of products) {
      const qty = quantities[prod.id] || 0;
      if (qty > 0) {
        const qrData = prod.code || prod.id;
        // Generate QR code data URL (Server side)
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          margin: 1,
          width: 200,
          errorCorrectionLevel: "M",
        });
        for (let i = 0; i < qty; i++) {
          items.push({ ...prod, qrDataUrl });
        }
      }
    }

    // Pagination chunk math
    const usableHeight = paperHeight - 2 * config.pageMargin;
    const stickerRowHeight = config.stickerHeight + config.gapSpacing;
    const rowsPerPage = Math.floor((usableHeight + config.gapSpacing) / stickerRowHeight) || 1;
    const stickersPerPage = rowsPerPage * config.columns;

    const pages: any[][] = [];
    for (let i = 0; i < items.length; i += stickersPerPage) {
      pages.push(items.slice(i, i + stickersPerPage));
    }

    const docStyles = StyleSheet.create({
      page: {
        padding: mmToPoints(config.pageMargin),
        backgroundColor: "#ffffff",
      },
      grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: mmToPoints(config.gapSpacing),
      },
      sticker: {
        width: mmToPoints(config.stickerWidth),
        height: mmToPoints(config.stickerHeight),
        paddingHorizontal: mmToPoints(3),
        paddingVertical: mmToPoints(2.5),
        borderWidth: config.showBorder ? 0.5 : 0,
        borderColor: "#cbd5e1",
        flexDirection: "row",
        alignItems: "center",
      },
      qrSection: {
        width: "30%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderRightWidth: 0.5,
        borderRightColor: "#e2e8f0",
        paddingRight: mmToPoints(2.5),
      },
      qrImage: {
        width: 40,
        height: 40,
        objectFit: "contain",
      },
      qrCodeText: {
        fontSize: 6.5,
        fontFamily: "Helvetica-Bold",
        color: "#94a3b8",
        marginTop: 3,
        textAlign: "center",
        letterSpacing: 0.5,
      },
      detailSection: {
        flex: 1,
        height: "100%",
        paddingLeft: mmToPoints(3),
        flexDirection: "column",
        justifyContent: "space-between",
      },
      brandContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 3,
      },
      logo: {
        width: 8,
        height: 8,
        marginRight: 3,
        objectFit: "contain",
      },
      brand: {
        fontSize: 7.5,
        fontFamily: "Helvetica-Bold",
        textTransform: "uppercase",
        color: "#0f172a",
        letterSpacing: 1.2,
      },
      title: {
        fontSize: 10.5,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
        lineHeight: 1.15,
        textTransform: "uppercase",
      },
      hsnBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        backgroundColor: "#f8fafc",
        borderWidth: 0.5,
        borderColor: "#cbd5e1",
        borderRadius: 2,
        marginTop: 2,
        alignSelf: "flex-start",
      },
      hsnText: {
        fontSize: 6.5,
        fontFamily: "Helvetica-Bold",
        color: "#475569",
      },
      pricingMfgRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderTopWidth: 0.5,
        borderTopColor: "#f1f5f9",
        paddingTop: 4,
        marginTop: "auto",
      },
      priceCol: {
        flexDirection: "column",
      },
      priceLabel: {
        fontSize: 5.5,
        color: "#94a3b8",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold",
        marginBottom: 1,
      },
      priceBadge: {
        backgroundColor: "#0f172a",
        borderRadius: 2,
        paddingHorizontal: 4,
        paddingVertical: 2,
        flexDirection: "row",
        alignItems: "center",
      },
      mrpText: {
        fontSize: 8.5,
        fontFamily: "Helvetica-Bold",
        color: "#ffffff",
      },
      mrpSubtext: {
        fontSize: 5,
        fontFamily: "Helvetica",
        color: "#cbd5e1",
        marginLeft: 2.5,
      },
      mfgCol: {
        flexDirection: "column",
        alignItems: "flex-end",
      },
      mfgLabel: {
        fontSize: 5.5,
        color: "#94a3b8",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold",
        marginBottom: 1.5,
      },
      mfgText: {
        fontSize: 7.5,
        fontFamily: "Helvetica-Bold",
        color: "#334155",
      },
      address: {
        fontSize: 5.5,
        color: "#64748b",
        borderTopWidth: 0.5,
        borderTopColor: "#e2e8f0",
        paddingTop: 2,
        marginTop: 2,
      },
    });

    const StickerDocument = () => (
      <Document>
        {pages.map((pageItems, pageIdx) => (
          <Page
            key={pageIdx}
            size={config.pageSize}
            orientation={config.orientation}
            style={docStyles.page}
          >
            <View style={docStyles.grid}>
              {pageItems.map((item, idx) => {
                const mrpAmount = item.defaultRate * (1 + item.defaultGstPercent / 100);
                return (
                  <View key={idx} style={docStyles.sticker} wrap={false}>
                    {/* Left QR Section */}
                    <View style={docStyles.qrSection}>
                      <Image src={item.qrDataUrl} style={docStyles.qrImage} />
                      {toggles.showCode && (
                        <Text style={docStyles.qrCodeText}>{item.code || "N/A"}</Text>
                      )}
                    </View>

                    {/* Right Details Section */}
                    <View style={docStyles.detailSection}>
                      {(toggles.showLogo || toggles.showBrand) && (
                        <View style={docStyles.brandContainer}>
                          {toggles.showLogo && logoDataUrl ? (
                            <Image src={logoDataUrl} style={docStyles.logo} />
                          ) : null}
                          {toggles.showBrand && (
                            <Text style={docStyles.brand}>{custom.brandName}</Text>
                          )}
                        </View>
                      )}

                      <Text style={docStyles.title}>{item.name}</Text>

                      {toggles.showHSN && item.hsnCode && (
                        <View style={docStyles.hsnBadge}>
                          <Text style={docStyles.hsnText}>HSN: {item.hsnCode}</Text>
                        </View>
                      )}

                      <View style={docStyles.pricingMfgRow}>
                        {toggles.showMRP && (
                          <View style={docStyles.priceCol}>
                            <Text style={docStyles.priceLabel}>Retail Price</Text>
                            <View style={docStyles.priceBadge}>
                              <Text style={docStyles.mrpText}>
                                Rs. {mrpAmount.toFixed(2)}
                              </Text>
                              <Text style={docStyles.mrpSubtext}>incl. tax</Text>
                            </View>
                          </View>
                        )}
                        
                        {toggles.showMfgDate && (
                          <View style={docStyles.mfgCol}>
                            <Text style={docStyles.mfgLabel}>Mfg Date</Text>
                            <Text style={docStyles.mfgText}>{custom.mfgDate}</Text>
                          </View>
                        )}
                      </View>

                      {toggles.showAddress && (
                        <Text style={docStyles.address}>{custom.address}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Page>
        ))}
      </Document>
    );

    const stream = await pdf(<StickerDocument />).toBuffer();

    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="stickers_${config.pageSize.toLowerCase()}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Sticker PDF generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate stickers PDF" },
      { status: 500 }
    );
  }
}
