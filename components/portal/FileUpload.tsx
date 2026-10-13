'use client';

import { useId, useState } from 'react';
import { checkFile, FILE_RULES, safeObjectName, type UploadBucket } from '@/lib/files';
import { createClient } from '@/lib/supabase/client';

/**
 * Uploads straight from the browser to Supabase Storage using the signed-in user's
 * session, so storage policies decide what is allowed. On success the object path
 * (plus type and size) is placed in hidden inputs for the surrounding form.
 */
export function FileUpload({
  bucket, folder = '', name = 'file_path', label, required, onUploaded,
}: {
  bucket: UploadBucket; folder?: string; name?: string; label: string; required?: boolean; onUploaded?: (path: string) => void;
}) {
  const id = useId();
  const [path, setPath] = useState('');
  const [meta, setMeta] = useState({ type: '', size: 0 });
  const [status, setStatus] = useState<{ tone: 'muted' | 'ok' | 'bad'; text: string }>({ tone: 'muted', text: '' });
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    setPath('');
    if (!file) return setStatus({ tone: 'muted', text: '' });
    const problem = checkFile(bucket, file);
    if (problem) return setStatus({ tone: 'bad', text: problem });
    setBusy(true);
    setStatus({ tone: 'muted', text: 'Uploading…' });
    const objectPath = `${folder ? `${folder.replace(/\/+$/, '')}/` : ''}${safeObjectName(bucket, file)}`;
    const { error } = await createClient().storage.from(bucket).upload(objectPath, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return setStatus({ tone: 'bad', text: 'The upload did not complete. Please try again.' });
    setPath(objectPath);
    setMeta({ type: file.type, size: file.size });
    setStatus({ tone: 'ok', text: `Uploaded: ${file.name}` });
    onUploaded?.(objectPath);
  };

  const types = Object.values(FILE_RULES[bucket].types);
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-bad" aria-hidden="true"> *</span>}</label>
      <input
        id={id}
        type="file"
        accept={Object.keys(FILE_RULES[bucket].types).join(',')}
        disabled={busy}
        onChange={(e) => upload(e.target.files?.[0])}
        className="field"
        aria-describedby={`${id}-hint`}
        required={required && !path}
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        {[...new Set(types)].join(', ').toUpperCase()} up to {Math.round(FILE_RULES[bucket].maxBytes / 1024 / 1024)} MB.
      </p>
      <p role="status" className={status.tone === 'bad' ? 'mt-1 text-sm text-bad' : status.tone === 'ok' ? 'mt-1 text-sm text-ok' : 'mt-1 text-sm text-muted'}>{status.text}</p>
      <input type="hidden" name={name} value={path} />
      <input type="hidden" name={`${name}_type`} value={meta.type} />
      <input type="hidden" name={`${name}_size`} value={meta.size || ''} />
    </div>
  );
}
