import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/PolicyPage';

export const metadata: Metadata = { title: 'Refund Policy', alternates: { canonical: '/refund-policy' } };

export default function Page() {
  return <PolicyPage kind="refund" title="Refund Policy" />;
}
