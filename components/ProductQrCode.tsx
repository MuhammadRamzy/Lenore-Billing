"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";

interface ProductQrCodeProps {
  data: string;
  size?: number;
}

export function ProductQrCode({ data, size = 48 }: ProductQrCodeProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(data, { margin: 1, width: size })
      .then(setSrc)
      .catch(console.error);
  }, [data, size]);

  if (!src) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className="bg-slate-100 rounded animate-pulse shrink-0" 
      />
    );
  }
  
  return (
    <img 
      src={src} 
      alt="QR Code" 
      width={size} 
      height={size} 
      className="object-contain border border-slate-100 rounded p-0.5 bg-white shrink-0 shadow-sm" 
    />
  );
}
