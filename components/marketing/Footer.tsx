import Link from 'next/link';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings, toInternational, whatsappLink } from '@/lib/site';

const QUICK = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/login', label: 'Student Portal' },
];

export async function Footer() {
  const [{ academy }, programmes] = await Promise.all([getSiteSettings(), getProgrammes()]);
  return (
    <footer className="on-dark bg-navy">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo tone="dark" size={44} />
          <p className="mt-4 text-sm text-muted">{academy.tagline}</p>
          <ul className="mt-5 space-y-1 text-sm">
            {academy.phones.map((p) => (
              <li key={p}>
                <a href={`tel:+${toInternational(p)}`} className="inline-flex min-h-[28px] items-center gap-2 hover:underline">
                  <Phone size={16} aria-hidden="true" /> {p}
                </a>
              </li>
            ))}
            <li>
              <a href={whatsappLink(academy)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[28px] items-center gap-2 hover:underline">
                <MessageCircle size={16} aria-hidden="true" /> WhatsApp
              </a>
            </li>
            {academy.email && (
              <li>
                <a href={`mailto:${academy.email}`} className="inline-flex min-h-[28px] items-center gap-2 break-all hover:underline">
                  <Mail size={16} aria-hidden="true" /> {academy.email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <nav aria-label="Quick links">
          <h2 className="text-base font-semibold">Quick links</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {QUICK.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-1 text-muted hover:text-white hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Subjects and programmes">
          <h2 className="text-base font-semibold">Subjects and programmes</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {programmes.slice(0, 9).map((p) => (
              <li key={p.slug}>
                <Link href={`/subjects/${p.slug}`} className="inline-block py-1 text-muted hover:text-white hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/subjects" className="inline-block py-1 font-medium text-gold hover:underline">
                View all programmes
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-base font-semibold">Learning tips by email</h2>
          <p className="mt-4 text-sm text-muted">New articles from the academy. Unsubscribe at any time.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-col gap-3 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {academy.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li><Link href="/privacy" className="inline-block py-1 hover:underline">Privacy Policy</Link></li>
            <li><Link href="/terms" className="inline-block py-1 hover:underline">Terms of Service</Link></li>
            <li><Link href="/refund-policy" className="inline-block py-1 hover:underline">Refund Policy</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
