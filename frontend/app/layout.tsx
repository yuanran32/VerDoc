import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerDoc — 版本感知文档助手",
  description:
    "面向前端开发者的官方文档智能问答,回答带来源引用与版本标注,找不到证据就拒答。",
  applicationName: "VerDoc",
  authors: [{ name: "VerDoc" }],
  keywords: ["Vue", "RAG", "文档问答", "版本感知", "VerDoc"]
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('verdoc-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
