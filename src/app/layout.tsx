import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import Footer from '@/components/Footer';
import GlobalSettings from '@/components/GlobalSettings';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Legal Flow | 合約追蹤系統',
  description: 'Premium Legal Contract Tracking System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={outfit.variable}>
      <body className="flex flex-col min-h-screen">
        <div className="flex-grow">
          {children}
        </div>
        {/* <GlobalSettings /> Hidden for hotfix */}
        <Footer />
      </body>
    </html>
  );
}
