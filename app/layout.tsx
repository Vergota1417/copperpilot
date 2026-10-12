import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "CopperPilot — Circuit workbench",
 description: "Design, inspect and export electronics with an open-source circuit workbench.",
 icons: {icon: "/favicon.svg"}
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>){
 return <html lang="en"><body>{children}</body></html>;
}
