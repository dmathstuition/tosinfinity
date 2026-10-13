'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/portal/FileUpload';

/** Lets the Owner choose private or public before uploading, since that decides the bucket. */
export function UploadFields() {
  const [bucket, setBucket] = useState<'materials' | 'handouts'>('materials');
  return (
    <>
      <fieldset>
        <legend className="label">Who can open this file?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['materials', 'Private', 'Only the students and programmes you choose, plus their parents.'], ['handouts', 'Public handout', 'Anyone with the link. Do not use for personal documents.']] as const).map(([value, title, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-royal has-[:checked]:bg-royal/5">
              <input type="radio" name="bucket" value={value} checked={bucket === value} onChange={() => setBucket(value)} className="mt-1 accent-[rgb(var(--royal))]" />
              <span className="text-sm"><span className="font-semibold">{title}</span><br /><span className="text-muted">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* Keyed by bucket so switching visibility clears any file uploaded to the other bucket. */}
      <FileUpload key={bucket} bucket={bucket} name={`file_path_${bucket}`} label="File" required />
    </>
  );
}
