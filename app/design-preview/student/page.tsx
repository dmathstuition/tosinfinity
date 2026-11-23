import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { NavItem } from '@/components/portal/NavLinks';
import { ShellFrame } from '@/components/portal/Shell';
import { BookOpen, CalendarDays, ClipboardList, FileBarChart, MessageSquare, Sparkles } from 'lucide-react';
import { AiCard, ContinueLearning, CourseList, GreetingHeader, QuickLinks, WorkCard } from '@/components/portal/StudentHome';
import { MiniBars, Ring } from '@/components/ui/MiniBars';
import { Alert } from '@/components/ui/primitives';
import { AssistantClient } from '@/app/portal/assistant/AssistantClient';

export const metadata: Metadata = { title: 'Student preview', robots: { index: false, follow: false } };

/**
 * DEVELOPMENT ONLY. The learner's home screen and "Learn with AI" with sample data,
 * using the same components as the real pages. Sending a message here reports an
 * error because there is no session. In production this route returns 404.
 */
const NAV: NavItem[] = [
  { href: '/design-preview/student', label: 'Dashboard', icon: 'dashboard' },
  { href: '/design-preview/student#t', label: 'Timetable', icon: 'classes', group: 'Learning' },
  { href: '/design-preview/student#a', label: 'Assignments', icon: 'assignments', group: 'Learning' },
  { href: '/design-preview/student?ai=1', label: 'Learn with AI', icon: 'assistant', group: 'Learning' },
  { href: '/design-preview/student#r', label: 'Reports', icon: 'reports', group: 'Learning' },
];
const TABS: NavItem[] = [
  { href: '/design-preview/student', label: 'Home', icon: 'dashboard' },
  { href: '/design-preview/student#t', label: 'Classes', icon: 'classes' },
  { href: '/design-preview/student#a', label: 'Work', icon: 'assignments' },
  { href: '/design-preview/student?ai=1', label: 'AI tutor', icon: 'assistant' },
];

export default function StudentPreview({ searchParams }: { searchParams: { ai?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const soon = new Date(Date.now() + 2 * 86400000).toISOString();
  return (
    <ShellFrame profile={{ full_name: 'Sample Learner', role: 'student', student_code: 'TA-0000' }} nav={NAV} home="/design-preview/student" tabs={TABS} unread={1} recent={[]}>
      <div className="mb-4"><Alert tone="warning">Design preview with sample data. Nothing here is a real record.</Alert></div>
      {searchParams.ai ? (
        <AssistantClient firstName="Sample" initialLeft={36} />
      ) : (
        <>
          <GreetingHeader name="Sample Learner" code="TA-0000" streak={6} />
          <div className="mb-5">
            <QuickLinks items={[
              { href: '#t', label: 'Timetable', icon: CalendarDays, tone: 'bg-tile-lilac text-royal' },
              { href: '#a', label: 'My work', icon: ClipboardList, tone: 'bg-tile-peach text-accent' },
              { href: '#m', label: 'Materials', icon: BookOpen, tone: 'bg-tile-sky text-royal' },
              { href: '?ai=1', label: 'AI tutor', icon: Sparkles, tone: 'bg-tile-sun text-accent' },
              { href: '#r', label: 'Progress', icon: FileBarChart, tone: 'bg-tile-mint text-ok' },
              { href: '#g', label: 'Messages', icon: MessageSquare, tone: 'bg-tile-rose text-ember' },
            ]} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-4">
              <ContinueLearning next={{ id: 'x', title: 'Simultaneous equations practice', due_at: soon, missed: false }} done={5} missed={2} toDo={3} href={() => '/design-preview/student'} />
              <div className="grid gap-4 sm:grid-cols-2">
                <WorkCard handedIn={12} total={17} nextDue={soon} />
                <AiCard left={36} href="/design-preview/student?ai=1" />
              </div>
              <CourseList link="/design-preview/student" courses={[
                { id: '1', title: 'WAEC Mathematics', total: 24, done: 15 },
                { id: '2', title: 'IGCSE Physics', total: 16, done: 4 },
              ]} />
              <div className="grid gap-4 md:grid-cols-2">
                <section className="tile bg-tile-sky">
                  <h2 className="mb-3 text-lg font-semibold">Your marks</h2>
                  <MiniBars data={[62, 70, 58, 75, 81, 77, 88].map((v, i) => ({ label: String(i + 1), value: v }))} format={(n) => `${n}%`} highlight={6} label="Sample marks" emptyText="" />
                </section>
                <section className="tile flex items-center gap-4 bg-tile-mint">
                  <Ring percent={86} label="Attendance" />
                  <div><h2 className="text-lg font-semibold">Attendance</h2><p className="text-sm text-ink/70">19 of 22 lessons attended.</p></div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </ShellFrame>
  );
}
