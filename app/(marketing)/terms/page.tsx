import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/PolicyPage';

export const metadata: Metadata = { title: 'Terms of Service', alternates: { canonical: '/terms' } };

export default function Page() {
  return <PolicyPage kind="terms" title="Terms of Service" />;
}
