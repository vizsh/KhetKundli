"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR code in ink, drawn as SVG on this device (no service involved). */
export function Qr({ value, size = 132, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1c1a17ff", light: "#ffffff00" } })
      .then((s) => !off && setSvg(s))
      .catch(() => !off && setSvg(null));
    return () => { off = true; };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
      // The SVG comes from the qrcode library, generated from our own URL.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
