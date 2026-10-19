import type { Metadata } from "next";
import { Desk } from "@/components/desk/desk";

export const metadata: Metadata = { title: "Taluka Desk" };

export default function DeskPage() {
  return <Desk />;
}
