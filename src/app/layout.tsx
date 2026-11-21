import type { Metadata, Viewport } from "next";
import "./globals.css";

function resolveMetadataBase(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "후르츠파머 유천점 📌 구매 및 예약확인",
  description:
    "매일 새벽 경매 직송 신선 과일! 오픈카톡 닉네임으로 간편하게 픽업·배송 주문하고 내 예약을 확인하세요.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "후르츠파머 유천점 📌 구매 및 예약확인",
    description:
      "신선한 제철 과일 픽업·배송 예약! 장바구니 담고 오픈카톡 공구방으로 바로 주문하세요.",
    images: [
      {
        url: "/images/fruit-farmer-thumb.jpg",
        width: 1200,
        height: 1200,
        alt: "후르츠파머 유천점 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "후르츠파머 유천점 📌 구매 및 예약확인",
    description:
      "신선한 제철 과일 픽업·배송 예약! 장바구니 담고 오픈카톡 공구방으로 바로 주문하세요.",
    images: ["/images/fruit-farmer-thumb.jpg"],
  },
  icons: {
    icon: "/images/fruit-farmer-thumb.jpg",
    apple: "/images/fruit-farmer-thumb.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body>{children}</body>
    </html>
  );
}
