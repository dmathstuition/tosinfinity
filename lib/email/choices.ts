/** The optional email categories people can switch off (see CATEGORY in templates.ts). */
export const EMAIL_CHOICES = [
  { name: 'reminders', label: 'Reminders', hint: 'Lessons tomorrow and work due tomorrow.' },
  { name: 'reports', label: 'Weekly progress email', hint: 'A short summary every Friday.' },
  { name: 'updates', label: 'Updates', hint: 'New work, marks, messages and announcements.' },
] as const;
