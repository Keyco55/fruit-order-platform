import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "사장님 관리자 | 후르츠파머 유천점",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
