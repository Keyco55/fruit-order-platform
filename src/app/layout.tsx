import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리동네 과일가게 | 모바일 간편 예약 & 오픈카톡 자동 집계",
  description:
    "앱 설치 없이 오픈카톡 닉네임만으로 3초 만에 오늘의 신선 과일을 예약하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-[#f2f4f6] text-[#191f28] selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
