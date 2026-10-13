import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs scripts/gmail-relay.gs (the Google Apps Script the Owner pastes into Google)
 * inside a sandbox with simple stand-ins for Google's services, so its checks are
 * tested here even though the real thing runs on Google's servers.
 */
const SECRET = 'a-long-random-relay-secret-for-tests-0123456789';
type Sent = { to: string; subject: string; text: string; options: Record<string, unknown> };

function load(props: Record<string, string>, quota = 50) {
  const sent: Sent[] = [];
  const rows: unknown[][] = [];
  const cache = new Map<string, string>();
  const store = { ...props };
  const sandbox: Record<string, unknown> = {
    console: { error: () => {} },
    Logger: { log: () => {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k: string) => store[k] ?? null,
      setProperties: (o: Record<string, string>) => Object.assign(store, o),
    }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: { getRemainingDailyQuota: () => quota },
    GmailApp: {
      getAliases: () => ['alias@example.test'],
      sendEmail: (to: string, subject: string, text: string, options: Record<string, unknown>) => { sent.push({ to, subject, text, options }); },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ setMimeType: () => ({ body: s }) }) },
    Utilities: { formatDate: () => '2026-10-13' },
    Session: { getScriptTimeZone: () => 'Africa/Lagos', getActiveUser: () => ({ getEmail: () => 'owner@example.test' }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [{ getLastRow: () => rows.length, appendRow: (r: unknown[]) => rows.push(r) }] }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../scripts/gmail-relay.gs'), 'utf8'), sandbox);
  const post = (body: unknown) => {
    const out = (sandbox.doPost as (e: unknown) => { body: string })({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
    return JSON.parse(out.body) as { ok: boolean; error?: string };
  };
  return { post, sent, rows, store };
}

const good = { secret: SECRET, template: 'invoiceIssued', to: 'parent@example.test', subject: 'Invoice INV-2026-0001', html: '<p>Hello <b>there</b></p>', text: 'Hello there' };

describe('Gmail relay (Apps Script)', () => {
  let r: ReturnType<typeof load>;
  beforeEach(() => { r = load({ RELAY_SECRET: SECRET }); });

  it('sends a valid message from the academy with HTML and plain text', () => {
    expect(r.post(good)).toEqual({ ok: true });
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toMatchObject({ to: 'parent@example.test', subject: 'Invoice INV-2026-0001', text: 'Hello there' });
    expect(r.sent[0]!.options).toMatchObject({ name: 'Tosinfinity Academy', htmlBody: '<p>Hello <b>there</b></p>' });
  });

  it('refuses a missing or wrong secret and sends nothing', () => {
    for (const secret of [undefined, '', 'wrong', SECRET.slice(0, -1), SECRET + 'x']) {
      expect(r.post({ ...good, secret })).toEqual({ ok: false, error: 'unauthorised' });
    }
    expect(r.sent).toHaveLength(0);
  });

  it('locks itself after repeated wrong secrets, even against the right one', () => {
    for (let i = 0; i < 10; i++) r.post({ ...good, secret: 'guess' + i });
    expect(r.post(good)).toEqual({ ok: false, error: 'temporarily locked' });
    expect(r.sent).toHaveLength(0);
  });

  it('refuses to run when the secret has not been set, or is too short', () => {
    expect(load({}).post(good).error).toBe('relay secret is not set');
    expect(load({ RELAY_SECRET: 'short' }).post({ ...good, secret: 'short' }).error).toBe('relay secret is not set');
  });

  it('rejects bad input: recipients, several recipients, empty or oversized messages', () => {
    expect(r.post('not json').error).toBe('invalid json');
    for (const to of ['', 'nobody', 'a@b', 'a@example.test, b@example.test', 'a@example.test\nBcc: x@example.test', '<a@example.test>']) {
      expect(r.post({ ...good, to }).error, to).toBe('invalid recipient');
    }
    expect(r.post({ ...good, subject: '' }).error).toBe('invalid subject');
    expect(r.post({ ...good, html: '', text: '' }).error).toBe('empty message');
    expect(r.post({ ...good, html: 'x'.repeat(200001) }).error).toBe('message too large');
    expect(r.sent).toHaveLength(0);
  });

  it('removes line breaks from the subject so extra headers cannot be injected', () => {
    r.post({ ...good, subject: 'Hello\r\nBcc: attacker@example.test' });
    expect(r.sent[0]!.subject).toBe('Hello Bcc: attacker@example.test');
  });

  it('builds a plain-text version when only HTML is supplied', () => {
    r.post({ ...good, text: '', html: '<style>p{}</style><p>Line one</p><p>Tom &amp; Ada</p>' });
    expect(r.sent[0]!.text).toBe('Line one\nTom & Ada');
  });

  it('stops at the daily limit and when Gmail’s own quota is used up', () => {
    const limited = load({ RELAY_SECRET: SECRET, DAILY_LIMIT: '2' });
    expect([limited.post(good).ok, limited.post(good).ok, limited.post(good)]).toEqual([true, true, { ok: false, error: 'daily limit reached' }]);
    expect(limited.sent).toHaveLength(2);
    expect(load({ RELAY_SECRET: SECRET }, 0).post(good)).toEqual({ ok: false, error: 'gmail quota used up' });
  });

  it('uses the optional sender name, reply-to and a verified alias only', () => {
    const custom = load({ RELAY_SECRET: SECRET, SENDER_NAME: 'Tosin', REPLY_TO: 'hello@example.test', SEND_AS: 'alias@example.test' });
    custom.post(good);
    expect(custom.sent[0]!.options).toMatchObject({ name: 'Tosin', replyTo: 'hello@example.test', from: 'alias@example.test' });
    const unverified = load({ RELAY_SECRET: SECRET, SEND_AS: 'someone.else@example.test' });
    unverified.post(good);
    expect(unverified.sent[0]!.options.from).toBeUndefined();
  });

  it('logs who and when to the sheet, never the message, and neutralises formulas', () => {
    const logged = load({ RELAY_SECRET: SECRET, LOG_SHEET_ID: 'sheet' });
    logged.post({ ...good, to: '=cmd@example.test' });
    expect(logged.rows[0]).toEqual(['Time', 'Template', 'Recipient', 'Result']);
    expect(logged.rows[1]!.slice(1)).toEqual(['invoiceIssued', "'=cmd@example.test", 'sent']);
    expect(JSON.stringify(logged.rows)).not.toContain('Hello there');
  });
});
