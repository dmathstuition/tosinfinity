/**
 * Static marketing copy. Everything here is drawn from the academy flyer or describes
 * how this platform works. No results, accreditations or prices are claimed.
 * The Owner can override FAQs, testimonials, pricing and contact details in Settings.
 */
export const BENEFITS = [
  { icon: 'GraduationCap', title: 'Qualified and experienced tutor', body: 'Lessons are taught personally by the academy’s tutor, not handed to a rotating roster.' },
  { icon: 'CalendarClock', title: 'Flexible learning', body: 'Sessions are arranged around your schedule, with live lessons and recorded options where available.' },
  { icon: 'Globe', title: 'Learn from different locations', body: 'Home tutoring where available, and online tutoring wherever you have a connection.' },
  { icon: 'LineChart', title: 'Regular assessments and progress reports', body: 'Families see attendance, results and next steps rather than guessing how things are going.' },
  { icon: 'BookOpen', title: 'International and local curricula', body: 'Support across Nigerian and international programmes, including WAEC, IGCSE, UTME topics and SAT Math.' },
  { icon: 'ShieldCheck', title: 'Safe, respectful and inclusive', body: 'A learning environment where every learner is treated with patience and respect.' },
] as const;

export const STEPS = [
  { title: 'Apply', body: 'Tell us about the learner, the subjects needed and whether you prefer home or online tutoring. No payment is taken.' },
  { title: 'Conversation and assessment', body: 'We contact you to understand current level, goals and any examination targets.' },
  { title: 'Agree a schedule', body: 'Lesson days, times and delivery are agreed, and the learner’s account is activated.' },
  { title: 'Learn and track progress', body: 'Lessons begin. Attendance, assignments, results and reports are visible in the student and parent portals.' },
] as const;

export const DELIVERY = [
  {
    key: 'home',
    title: 'Home tutoring',
    body: 'Face-to-face lessons at the learner’s home, subject to location and availability.',
    points: ['In-person attention', 'A familiar environment', 'Arranged by location'],
  },
  {
    key: 'online',
    title: 'Online tutoring',
    body: 'Live lessons by video call with shared materials, from wherever the learner is.',
    points: ['Learn from anywhere', 'Join from the student portal', 'Materials shared digitally'],
  },
] as const;

export const DEFAULT_FAQ = [
  { question: 'Do you offer both home and online tutoring?', answer: 'Yes. You can choose home tutoring or online tutoring when you apply. Home tutoring depends on your location and availability.' },
  { question: 'Which subjects do you teach?', answer: 'Mathematics from upper primary to senior secondary, IGCSE Mathematics, SAT Mathematics Foundation, Further Mathematics, Physics, Chemistry and Biology, plus preparation for WAEC, IGCSE and selected UTME topics.' },
  { question: 'How do I enrol?', answer: 'Complete the application form. We will contact you to discuss the learner’s needs and agree a schedule. No payment is taken when you apply.' },
  { question: 'How will I know how my child is doing?', answer: 'Parents receive their own account showing attendance, assessment results, tutor feedback and progress reports for their linked child.' },
  { question: 'How are fees and payments handled?', answer: 'Fees are agreed with each family before lessons begin. Invoices and receipts are available in your account. Please contact us for current rates.' },
  { question: 'Who teaches the lessons?', answer: 'Tosinfinity Academy is owner-led. Lessons are taught by the academy’s tutor.' },
];
