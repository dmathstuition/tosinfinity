import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookOpen, Car, Download, HelpCircle, Home, MapPin, NotebookPen, Target } from 'lucide-react';
import { FeedbackForm, PollAnswer, QuestionForm, RsvpForm } from '@/components/family/RoomForms';
import type { NavItem } from '@/components/portal/NavLinks';
import { PollResults } from '@/components/portal/PollResults';
import { ShellFrame } from '@/components/portal/Shell';
import { SectionHeading } from '@/components/portal/WelcomeBanner';
import { Alert, Badge, Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Lesson room preview', robots: { index: false, follow: false } };

/**
 * DEVELOPMENT ONLY. The learner's lesson room with sample data, using the real form
 * components. Buttons will report "Please sign in again" because there is no session.
 * In production this route returns 404.
 */
const NAV: NavItem[] = [
  { href: '/design-preview', label: 'Dashboard', icon: 'dashboard' },
  { href: '/design-preview/lesson', label: 'Timetable', icon: 'classes', group: 'Learning' },
  { href: '/design-preview#b', label: 'Assignments', icon: 'assignments', group: 'Learning' },
  { href: '/design-preview#c', label: 'Materials', icon: 'materials', group: 'Learning' },
  { href: '/design-preview#d', label: 'Messages', icon: 'messages', group: 'Updates' },
];
const ID = '00000000-0000-4000-8000-000000000000';

export default function LessonPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ShellFrame profile={{ full_name: 'Sample Student', role: 'student', student_code: 'TA-0000-000' }} nav={NAV} home="/design-preview" unread={1} recent={[]}>
      <div className="mb-4"><Alert tone="warning">Lesson room preview with sample data. Nothing here is a real record, and the buttons cannot save.</Alert></div>

      <section className="tile mb-4 bg-tile-peach">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-3 py-1 text-xs font-semibold shadow-xs"><Home size={14} aria-hidden="true" /> Home lesson</p>
            <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight sm:text-[2.1rem]">JSS2 Mathematics: Fractions</h1>
            <p className="mt-1 text-ink/75">Sample day, 16:00 · 60 minutes</p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-ink/75"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Sample address (not real)</p>
          </div>
          <Badge tone="blue">scheduled</Badge>
        </div>
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface/85 px-4 py-3 text-sm font-semibold shadow-xs"><Car size={18} aria-hidden="true" className="text-accent" /> Your tutor set off at 15:20 and is on the way.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          <section className="tile bg-tile-sun">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">Quick check from your tutor</p>
            <PollAnswer pollId={ID} classId={ID} question="What is 3/4 as a decimal?" options={['0.34', '0.75', '0.43']} />
          </section>
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Target size={18} aria-hidden="true" className="text-link" /> What this lesson is about</h2>
            <p className="mt-2">Adding and subtracting fractions with different denominators.</p>
          </Card>
          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><NotebookPen size={18} aria-hidden="true" className="text-link" /> After the lesson</h2>
            <h3 className="mt-3 text-sm font-bold uppercase tracking-wider text-muted">What we covered</h3>
            <p className="mt-1">Equivalent fractions and finding a common denominator.</p>
            <div className="mt-4 rounded-2xl bg-tile-sun p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider">Homework</h3>
              <p className="mt-1">Exercise 4, questions 1 to 6.</p>
            </div>
          </section>
          <Card>
            <SectionHeading title="Quick checks" count={1} />
            <div className="rounded-2xl bg-sunken p-4">
              <p className="mb-3 font-semibold">Which fraction is the largest?</p>
              <PollResults poll={{ id: ID, question: '', options: ['1/2', '2/3', '3/8'], status: 'closed', my_choice: 1, correct_index: 1, counts: [1, 2, 0], answers: 3 }} />
            </div>
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><HelpCircle size={18} aria-hidden="true" className="text-link" /> Ask your tutor</h2>
            <div className="mt-3"><QuestionForm classId={ID} /></div>
            <div className="mt-4 rounded-2xl bg-sunken p-4">
              <p className="font-medium">Why do we flip the fraction when dividing?</p>
              <p className="mt-2 rounded-xl bg-tile-mint p-3 text-sm"><span className="font-semibold">Tutor: </span>Dividing by a number is the same as multiplying by its reciprocal.</p>
            </div>
          </Card>
        </div>
        <aside className="space-y-4">
          <section className="tile bg-tile-mint">
            <h2 className="text-lg font-semibold">Will you be there?</h2>
            <p className="mb-3 mt-1 text-sm text-ink/75">Letting your tutor know helps them plan the journey.</p>
            <RsvpForm classId={ID} studentId={ID} current="attending" note={null} />
          </section>
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen size={18} aria-hidden="true" className="text-link" /> Materials for this lesson</h2>
            <p className="mt-3 flex min-h-[48px] items-center justify-between gap-3 rounded-2xl bg-sunken px-3 py-2 text-sm font-medium">Fractions worksheet <Download size={16} aria-hidden="true" /></p>
          </Card>
          <section className="tile bg-tile-lilac">
            <h2 className="text-lg font-semibold">How well did you understand?</h2>
            <p className="mb-3 mt-1 text-sm text-ink/75">Be honest. It helps your tutor plan the next lesson.</p>
            <FeedbackForm classId={ID} current={3} comment={null} />
          </section>
        </aside>
      </div>
    </ShellFrame>
  );
}
