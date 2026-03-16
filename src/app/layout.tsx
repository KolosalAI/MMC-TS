import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GGUF Memory Calculator",
  description:
    "Estimate RAM/VRAM requirements for GGUF-quantized LLMs. Parse GGUF metadata from URLs or local files and calculate model + KV cache memory usage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
