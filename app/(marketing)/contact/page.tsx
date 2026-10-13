import type { Metadata } from 'next';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { PageHero } from '@/components/marketing/sections';
import { getSiteSettings, toInternational, whatsappLink } from '@/lib/site';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Tosinfinity Academy by phone, WhatsApp or the contact form.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const { academy } = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Contact" title="We would be glad to hear from you" intro="Ask a question about tutoring, or apply directly if you are ready to begin." />
      <div className="container-page grid gap-8 py-14 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Call us</h2>
            <ul className="mt-3 space-y-2">
              {academy.phones.map((p) => (
                <li key={p}>
                  <a href={`tel:+${toInternational(p)}`} className="inline-flex min-h-[44px] items-center gap-2 font-medium text-link hover:underline">
                    <Phone size={18} aria-hidden="true" /> {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-semibold">WhatsApp</h2>
            <a href={whatsappLink(academy, 'Hello Tosinfinity Academy, I would like to ask about tutoring.')} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-[44px] items-center gap-2 font-medium text-link hover:underline">
              <MessageCircle size={18} aria-hidden="true" /> Start a WhatsApp chat
            </a>
          </div>
          {academy.email && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Email</h2>
              <a href={`mailto:${academy.email}`} className="mt-3 inline-flex min-h-[44px] items-center gap-2 break-all font-medium text-link hover:underline">
                <Mail size={18} aria-hidden="true" /> {academy.email}
              </a>
            </div>
          )}
          {academy.address && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Location</h2>
              <p className="mt-3 flex gap-2 text-muted"><MapPin size={18} className="mt-1 shrink-0" aria-hidden="true" /> {academy.address}</p>
            </div>
          )}
        </div>
        <div className="card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Send a message</h2>
          <p className="mb-6 mt-1 text-sm text-muted">We use your details only to reply to you.</p>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
