import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Anek_Latin, Courier_Prime, Kalam, Tiro_Devanagari_Marathi } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";

const anekLatin = Anek_Latin({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-anek-latin" });
const anekDeva = Anek_Devanagari({ subsets: ["devanagari"], axes: ["wdth"], variable: "--font-anek-deva" });
const courierPrime = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier-prime" });
const kalam = Kalam({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-kalam" });
const tiroMarathi = Tiro_Devanagari_Marathi({ subsets: ["devanagari"], weight: "400", variable: "--font-tiro-marathi" });

export const metadata: Metadata = {
  title: { default: "KhetKundli", template: "%s · KhetKundli" },
  description:
    "Every pomegranate plot in Phaltan taluka keeps a living season record; together they reveal blight fronts, harvest waves and the shared water table.",
};

export const viewport: Viewport = { themeColor: "#cda868" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anekLatin.variable} ${anekDeva.variable} ${courierPrime.variable} ${tiroMarathi.variable} ${kalam.variable} h-full`}
    >
      <body className="board-fibre min-h-full">
        <MotionProvider><TooltipProvider delayDuration={250}>{children}</TooltipProvider></MotionProvider>
      </body>
    </html>
  );
}
