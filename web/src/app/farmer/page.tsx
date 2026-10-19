import type { Metadata, Viewport } from "next";
import { Phone } from "@/components/farmer/phone";

export const metadata: Metadata = { title: "Sunita's plot" };
export const viewport: Viewport = { themeColor: "#cda868", width: "device-width", initialScale: 1 };

export default function FarmerPage() {
  return <Phone />;
}
