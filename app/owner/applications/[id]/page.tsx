import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { isUuid, ownerContext } from '@/lib/owner';
import { toInternational } from '@/lib/site';
import { adminConfigured } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/time';
import { approveApplicationAction, rejectApplicationAction, saveNotesAction } from '../actions';

export const metadata = { title: 'Application' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-sm">{value}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { data: a } = await supabase.from('applications').select('*').eq('id', params.id).maybeSingle();
  if (!a) notFound();
  const open = a.status === 'new' || a.status === 'in_review';
  const wa = `https://wa.me/${toInternational(a.guardian_phone)}`;

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/applications" className="text-link hover:underline">← All applications</Link></p>
      <PageHeader
        title={a.student_name}
        description={`Application received ${formatDate(a.created_at)}`}
        actions={<Badge tone={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'orange'}>{a.status.replace('_', ' ')}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Learner</h2>
            <dl className="mt-2 divide-y divide-line">
              <Row label="Full name" value={a.student_name} />
              <Row label="Date of birth" value={a.student_dob ? formatDate(a.student_dob) : null} />
              <Row label="Age" value={a.student_age} />
              <Row label="Class / year" value={a.school_year} />
              <Row label="Curriculum" value={a.curriculum} />
              <Row label="Learner’s email" value={a.student_email} />
              <Row label="Location" value={a.location} />
            </dl>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Learning requirements</h2>
            <dl className="mt-2 divide-y divide-line">
              <Row label="Subjects" value={(a.subjects as string[]).join(', ')} />
              <Row label="Delivery" value={a.delivery === 'home' ? 'Home tutoring' : 'Online tutoring'} />
              <Row label="Current level" value={a.current_level} />
              <Row label="Examination target" value={a.exam_target} />
              <Row label="Preferred times" value={a.preferred_times} />
              <Row label="Challenges" value={a.challenges} />
              <Row label="Strengths" value={a.strengths} />
              <Row label="Desired outcomes" value={a.desired_outcomes} />
              <Row label="Additional notes" value={a.notes} />
              <Row label="Consent given" value={formatDate(a.consent_at)} />
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Parent or guardian</h2>
            <p className="mt-2 font-medium">{a.guardian_name} <span className="font-normal text-muted">({a.guardian_relationship})</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={`tel:${a.guardian_phone}`} external variant="outline" size="sm">Call {a.guardian_phone}</ButtonLink>
              <ButtonLink href={wa} external variant="outline" size="sm">WhatsApp</ButtonLink>
              <ButtonLink href={`mailto:${a.guardian_email}`} external variant="outline" size="sm">Email</ButtonLink>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{a.guardian_email}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Internal notes</h2>
            <p className="mb-3 text-sm text-muted">Only you can see these.</p>
            {open ? (
              <ActionForm action={saveNotesAction} submitLabel="Save" variant="secondary" hidden={{ id: a.id }}>
                <div>
                  <label htmlFor="internal_notes" className="sr-only">Internal notes</label>
                  <textarea id="internal_notes" name="internal_notes" rows={4} defaultValue={a.internal_notes ?? ''} className="field" />
                </div>
                <div>
                  <label htmlFor="status" className="label">Status</label>
                  <select id="status" name="status" defaultValue={a.status} className="field">
                    <option value="new">New</option>
                    <option value="in_review">In review</option>
                  </select>
                </div>
              </ActionForm>
            ) : <p className="whitespace-pre-line text-sm">{a.internal_notes || 'No notes.'}</p>}
          </Card>

          {a.status === 'approved' && a.student_id && (
            <Alert tone="success">Approved {a.decided_at ? formatDate(a.decided_at) : ''}. <Link className="font-semibold underline" href={`/owner/students/${a.student_id}`}>Open student profile</Link></Alert>
          )}
          {a.status === 'rejected' && <Alert tone="error">Rejected. Reason given: {a.rejection_reason}</Alert>}

          {open && (
            <>
              <Card>
                <h2 className="text-lg font-semibold">Approve</h2>
                <p className="mb-4 mt-1 text-sm text-muted">Creates the student profile and ID, then emails a secure link to set a password. No password is ever emailed.</p>
                {!adminConfigured() && <div className="mb-4"><Alert tone="warning">Set SUPABASE_SERVICE_ROLE_KEY on the server before approving.</Alert></div>}
                <ActionForm action={approveApplicationAction} submitLabel="Approve and create accounts" hidden={{ id: a.id }} confirm={`Approve ${a.student_name} and create their account?`}>
                  <div>
                    <label htmlFor="student_email" className="label">Student’s login email</label>
                    <input id="student_email" name="student_email" type="email" required defaultValue={a.student_email ?? ''} className="field" aria-describedby="student_email-hint" />
                    <p id="student_email-hint" className="mt-1 text-xs text-muted">Must be different from the parent’s email. The activation link is sent here.</p>
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="create_parent" defaultChecked className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
                    <span>Also create or link a parent account for <strong>{a.guardian_email}</strong>, linked to this student only.</span>
                  </label>
                </ActionForm>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold">Reject</h2>
                <ActionForm action={rejectApplicationAction} submitLabel="Reject application" variant="danger" hidden={{ id: a.id }} confirm="Reject this application and email the family?">
                  <div>
                    <label htmlFor="reason" className="label">Reason (sent to the family)</label>
                    <textarea id="reason" name="reason" rows={3} required className="field" />
                  </div>
                </ActionForm>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
