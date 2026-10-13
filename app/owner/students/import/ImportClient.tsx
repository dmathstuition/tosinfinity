'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert, Badge, TableWrap, td, th } from '@/components/ui/primitives';
import { parseCsv, STUDENT_CSV_COLUMNS, validateStudentRows, type CsvRowResult } from '@/lib/validation/student';
import { importStudentsAction, type ImportResult } from '../actions';

const SAMPLE = `full_name,email,phone,date_of_birth,school_year,curriculum,location,delivery\r\nSample Student,sample.student@example.com,08000000000,2012-05-14,JSS2,Nigerian,,online\r\n`;

export function ImportClient({ existingEmails }: { existingEmails: string[] }) {
  const [rows, setRows] = useState<CsvRowResult[] | null>(null);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (file: File | undefined) => {
    setResults(null);
    setError('');
    setRows(null);
    if (!file) return;
    if (file.size > 1_000_000) return setError('That file is too large. Use a CSV under 1 MB.');
    const parsed = validateStudentRows(parseCsv(await file.text()), existingEmails);
    if (parsed.headerError) return setError(parsed.headerError);
    if (parsed.results.length === 0) return setError('The file has a header but no student rows.');
    if (parsed.results.length > 200) return setError('Import up to 200 students at a time.');
    setRows(parsed.results);
  };

  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalid = (rows?.length ?? 0) - valid.length;

  const run = () =>
    start(async () => {
      const res = await importStudentsAction(valid.map((r) => ({ line: r.line, data: r.data })));
      if (res.error) setError(res.error);
      setResults(res.results);
      setRows(null);
    });

  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor="csv" className="label">CSV file</label>
        <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="field" aria-describedby="csv-hint" />
        <p id="csv-hint" className="mt-1 text-xs text-muted">
          Columns: {STUDENT_CSV_COLUMNS.join(', ')}. Only full_name and email are required.{' '}
          <a className="text-link underline" download="students-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}>Download a template</a>
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {rows && (
        <>
          <Alert tone={invalid ? 'warning' : 'success'}>
            {valid.length} row{valid.length === 1 ? '' : 's'} ready to import{invalid ? `, ${invalid} with problems that will be skipped` : ''}. Nothing has been saved yet.
          </Alert>
          <TableWrap>
            <table className="w-full">
              <caption className="sr-only">Import preview</caption>
              <thead className="border-b border-line"><tr>
                <th scope="col" className={th}>Line</th><th scope="col" className={th}>Name</th><th scope="col" className={th}>Email</th>
                <th scope="col" className={th}>Class</th><th scope="col" className={th}>Check</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td className={td}>{r.line}</td>
                    <td className={td}>{r.data.full_name}</td>
                    <td className={`${td} break-all`}>{r.data.email}</td>
                    <td className={td}>{r.data.school_year}</td>
                    <td className={td}>{r.errors.length ? <span className="text-bad">{r.errors.join('; ')}</span> : <Badge tone="green">Ready</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div>
            <Button onClick={run} disabled={pending || valid.length === 0}>
              {pending ? 'Importing…' : `Import ${valid.length} student${valid.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}

      {results && results.length > 0 && (
        <TableWrap>
          <table className="w-full">
            <caption className="sr-only">Import results</caption>
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>Line</th><th scope="col" className={th}>Email</th><th scope="col" className={th}>Result</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {results.map((r) => (
                <tr key={r.line}>
                  <td className={td}>{r.line}</td>
                  <td className={`${td} break-all`}>{r.email}</td>
                  <td className={td}><span className={r.ok ? 'text-ok' : 'text-bad'}>{r.message}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
