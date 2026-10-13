import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/PolicyPage';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

export default function Page() {
  return <PolicyPage kind="privacy" title="Privacy Policy" />;
}
