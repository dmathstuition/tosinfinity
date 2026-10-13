import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from '../AuthForms';

export const metadata: Metadata = { title: 'Forgot password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-muted">Enter your email or student ID and we will send a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-sm"><Link href="/login" className="font-medium text-link hover:underline">Back to sign in</Link></p>
    </>
  );
}
