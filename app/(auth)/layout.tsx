import Link from 'next/link';
import { CalendarDays, FileBarChart, MessageSquare, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const FEATURES = [
  { icon: CalendarDays, title: 'Timetable and classes', body: 'See what is coming up and join online lessons.' },
  { icon: FileBarChart, title: 'Results and reports', body: 'Marks, tutor feedback and progress reports.' },
  { icon: MessageSquare, title: 'Private messages', body: 'Talk to the academy directly and securely.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-cloud text-ink lg:flex-row">
      <aside className="on-dark relative isolate hidden flex-col justify-between overflow-hidden bg-brand-deep p-12 lg:flex lg:w-[46%] xl:p-16">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-grid bg-[size:44px_44px] mask-fade-b" />
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-20 -z-10 h-96 w-96 rounded-full bg-royal blur-3xl" />

        <Link href="/" aria-label="Tosinfinity Academy home" className="w-fit rounded-xl"><Logo tone="dark" size={52} priority /></Link>

        <div className="animate-rise">
          <p className="eyebrow !text-gold">Student and parent portal</p>
          <p className="mt-5 max-w-md font-heading text-[2.5rem] font-semibold leading-[1.1] tracking-display">
            Your classes, work and progress in one place.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-gold ring-1 ring-inset ring-white/15">
                  <f.icon size={20} aria-hidden="true" />
                </span>
                <span><span className="block font-semibold">{f.title}</span><span className="block text-sm text-muted">{f.body}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck size={16} aria-hidden="true" className="text-gold" />
          Each family sees only its own records. © {new Date().getFullYear()} Tosinfinity Academy
        </p>
      </aside>

      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div aria-hidden="true" className="absolute inset-0 bg-grid-ink bg-[size:48px_48px] mask-fade-b" />
        <div className="relative w-full max-w-md animate-rise">
          <Link href="/" aria-label="Tosinfinity Academy home" className="mb-8 inline-block rounded-xl lg:hidden"><Logo size={44} /></Link>
          <div className="card p-6 shadow-lift sm:p-9">{children}</div>
          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/" className="font-medium text-link underline-offset-4 hover:underline">← Back to the website</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
