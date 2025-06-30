
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
// AppLayout is no longer directly rendered here, but within specific pages that need it.
// Or, AppLayout itself checks auth and path. For simplicity, we'll keep AppLayout structure as is,
// and it will handle conditional rendering/redirects.
import AppLayout from '@/components/layout/app-layout';
import { AuthProvider } from '@/context/auth-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FlowForm - Dynamic Workflow Management',
  description: 'Manage customer workflows, dynamic data collection, and task assignments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {/* AppLayout will internally handle routing and whether to show full layout or just children */}
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
