import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agency Intelligence',
  description: 'Inteligência de mídia, vendas e retenção para agências.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
