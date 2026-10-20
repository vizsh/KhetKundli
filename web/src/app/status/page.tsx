import type { Metadata } from "next";
import { StatusBoard } from "@/components/status-board";

export const metadata: Metadata = { title: "Demo status" };

export default function StatusPage() {
  return <StatusBoard />;
}
