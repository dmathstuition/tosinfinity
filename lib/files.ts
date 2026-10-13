/** File rules shared by the browser uploader and the server. Buckets enforce the same limits. */
export const FILE_RULES = {
  materials: {
    maxBytes: 50 * 1024 * 1024,
    types: {
      'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'text/plain': 'txt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-powerpoint': 'ppt', 'application/msword': 'doc',
    },
  },
  handouts: { maxBytes: 20 * 1024 * 1024, types: { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } },
  submissions: {
    maxBytes: 20 * 1024 * 1024,
    types: {
      'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'text/plain': 'txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    },
  },
  blog: { maxBytes: 5 * 1024 * 1024, types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } },
  'message-attachments': { maxBytes: 10 * 1024 * 1024, types: { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } },
} as const;

export type UploadBucket = keyof typeof FILE_RULES;

/** Buckets whose objects are private and served only through short-lived signed URLs. */
export const PRIVATE_BUCKETS = ['materials', 'student-documents', 'submissions', 'reports', 'message-attachments'] as const;

export function checkFile(bucket: UploadBucket, file: { type: string; size: number }): string | null {
  const rule = FILE_RULES[bucket];
  if (!(file.type in rule.types)) return 'That file type is not allowed here.';
  if (file.size > rule.maxBytes) return `The file is too large. The limit is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`;
  if (file.size === 0) return 'The file is empty.';
  return null;
}

/** Storage-safe file name: the extension comes from the verified MIME type, not the upload's name. */
export function safeObjectName(bucket: UploadBucket, file: { name: string; type: string }): string {
  const ext = (FILE_RULES[bucket].types as Record<string, string>)[file.type] ?? 'bin';
  const base = file.name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
  return `${id}-${base}.${ext}`;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
