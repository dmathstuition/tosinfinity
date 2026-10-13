'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Opens the browser print dialog, where "Save as PDF" produces the download. */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" /> {label}
    </Button>
  );
}
