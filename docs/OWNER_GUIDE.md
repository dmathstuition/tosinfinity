# Owner's Guide

How to run Tosinfinity Academy day to day. No technical knowledge is needed. Sign in at `/login`; everything below is under the **Owner** menu on the left (the ☰ button on a phone).

- [First things first](#first-things-first)
- [Configure the academy](#configure-the-academy)
- [Add and approve a student](#add-and-approve-a-student)
- [Link a parent account](#link-a-parent-account)
- [Schedule a home or online lesson](#schedule-a-home-or-online-lesson)
- [Run a lesson: the lesson room](#run-a-lesson-the-lesson-room)
- [Take attendance](#take-attendance)
- [Set and grade assignments](#set-and-grade-assignments)
- [Upload learning materials](#upload-learning-materials)
- [Generate a report](#generate-a-report)
- [Issue an invoice](#issue-an-invoice)
- [Reconcile a payment](#reconcile-a-payment)
- [Send an announcement](#send-an-announcement)
- [Publish a blog article](#publish-a-blog-article)
- [Messages](#messages)
- [Keeping the account safe](#keeping-the-account-safe)
- [If something looks wrong](#if-something-looks-wrong)

---

## First things first

**Turn on two-step verification.** Settings → **Security** → *Set up two-step verification*. Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or Authy) and enter the 6-digit code. From then on, signing in needs your password and a code from the app. Your account controls every family's records, so please do this on day one.

**The dashboard** shows what needs you today: pending applications, today's classes, registers not yet completed, work waiting to be marked, unpaid invoices and recent messages. The buttons along the top are shortcuts to the most common jobs.

**The bell** (top right) collects notifications: new applications, submitted work, messages and online payments.

## Configure the academy

**Settings** is a list of panels; open one, change it, press **Save**.

| Panel | What to check |
| --- | --- |
| Academy and contact details | Name, tagline, mission, phone numbers, WhatsApp number, public email, founder biography and qualifications. The two numbers from your flyer are already entered. No email address is shown on the website until you add one. List only qualifications you hold. |
| Time zone and currency | The academy's time zone (lesson times you type are in this zone) and currency code, e.g. `NGN`. |
| Brand colours | Optional. *Reset* returns to the original colours. |
| Pricing page | One line per rate: `Name \| Price \| Description`. Leave empty and the website shows "Contact us for current rates". |
| Frequently asked questions | Question on one line, answer underneath, blank line between questions. |
| Testimonials | Only real ones, with permission. They appear on the homepage only after you add them and tick the confirmation. |
| Privacy, terms and refund policy | Leave empty to use the built-in text, or paste your own. Please have these reviewed before launch. |
| Billing policy | The day of the month invoices are drafted, how many days families have to pay, and when reminders go out. |
| Notification preferences | Whether families get a reminder the day before a class. |
| Integrations | Shows whether email, payments and scheduled jobs are connected. If something says *Not configured*, it needs setting up by whoever manages the hosting (see `README.md`). |

**Programmes** (left menu) controls the subjects shown on the website. Open a programme to edit it, change its order, or untick *Show on the public website* to hide it. Only show programmes you actually offer.

## Add and approve a student

### From a website application

1. **Applications** shows every enquiry; new ones are counted on the menu. Search by name or filter by status.
2. Open an application to read it in full. Use **Call**, **WhatsApp** or **Email** to contact the family. Add **Internal notes** (only you see them) and set the status to *In review* while you are talking to the family.
3. To accept: under **Approve**, check the **student's login email**. It must be different from the parent's email, because each person has their own account. Leave *Also create or link a parent account* ticked to give the guardian access.
4. Press **Approve and create accounts**.

What happens: the student profile is created with a student ID such as `TA-2026-001`, the parent is linked to that child, and each receives an email with a secure link to choose their own password. You never see or send a password.

5. To decline: under **Reject**, write a short reason and press **Reject application**. The reason is included in the email to the family.

If the page says the activation email could not be sent, email is not connected yet. Once it is, open the student's profile and press **Send activation / password link**.

### Directly

**Students → Add student**. Enter the name and login email; the rest can be filled in later.

### Several at once

**Students → Import CSV**. Download the template, fill it in, choose the file. You get a preview showing which rows are ready and which have problems (missing name, bad email, duplicates). Nothing is saved until you press **Import**.

### After a student exists

Open their profile to set:

- **Billing**: *Hourly* (lesson time × rate), *Flat monthly* or *Flat term*, and the agreed amount.
- **Enrolment**: add the programmes they are taking.
- **Teaching notes**: private to you. Never shown to the student or parents.

To stop a student signing in without losing their records, set **Account status** to *Inactive*.

## Link a parent account

Open the student's profile → **Parents and guardians** → **Link a parent**. Enter the parent's name, email, phone and relationship, then **Link parent**.

- If the parent is new, they are emailed a link to choose a password.
- If they already have an account (for example, for another child), they are simply given access to this child as well, with no duplicate account. They will see a child selector in their portal.

Linking is your confirmation that the relationship is genuine. A parent can only ever see children you have linked to them. To withdraw access, press **Remove access** beside their name.

**Read-only guardian link (optional).** At the bottom of the profile you can create a link for someone without an account, such as a grandparent. It shows upcoming classes, attendance and learning targets only; never invoices, marks, messages, notes or the home address. It expires after the number of days you choose, and you can **Revoke** it at any time. Copy the link when it is shown; it is displayed once.

## Schedule a home or online lesson

**Classes → Schedule class**.

1. Give it a **title**, e.g. "JSS2 Mathematics: Algebra".
2. Choose the **date and start time** (in the academy's time zone) and the **duration**.
3. Choose **Online** or **Home tutoring**.
   - Online: paste the **meeting link** (Google Meet, Jitsi, or any `https://` link). Students get a **Join class** button from 15 minutes before the start.
   - Home: enter the **venue**.
4. Tick the **students** taking part.
5. Optional: **lesson objectives** and **notes** (the family can see these).
6. For a regular lesson, set **Repeat weekly for** the number of weeks.
7. Press **Schedule**.

If the time overlaps another class you are warned and nothing is saved. Change the time, or tick *Schedule anyway*. Families are notified of new classes.

**The weekly calendar** (Classes) shows the week; orange bars are home lessons, blue are online. Press **+** on a day to schedule on that date.

**To reschedule**, open the class, change the date or time and **Save changes**. Affected families are notified automatically. **To cancel**, use **Cancel this class**; it stays on record as cancelled and families are told.

## Run a lesson: the lesson room

Every class has a **lesson room**. Open a class and press **Lesson room** (today's classes on the dashboard open it directly). Learners have their own version of the same page under **Timetable**. It works the same way for home and online lessons, and it refreshes by itself every few seconds, so keep it open on your phone or laptop while you teach.

**Before the lesson**

- **Who is coming** shows each learner's reply: *Coming*, *Cannot attend* (with their reason) or *No reply yet*. The learner or a parent answers from their portal, and you are notified if someone cannot attend. This is a courtesy, not the register.
- **Online lesson:** if there is no meeting link, press **Create online room**. Learners get a **Join class** button from 15 minutes before the start. You can instead paste a Google Meet or Zoom link on the class details page. Press **Start lesson** to open the meeting yourself.
- **Home lesson:** **Open in Maps** shows the venue. Press **Tell the family I am on my way** when you set off; the learner and parents get a notification and see it on their page.
- **Materials for this lesson:** attach files from your Resources. Only learners in this class (and their parents) can open them.

**During the lesson**

- **Quick checks** are one-question polls. Type the question and the options, and optionally the number of the correct option. Learners answer on their own device, once. You see the totals as they arrive. Press **Close and reveal** to show learners the right answer and the totals. Leave the correct option blank for questions like "How confident do you feel?".
- **Questions from learners** appear as they are asked. Each question is private between you and that learner's family, even in a shared class, so shy learners can ask freely. Type an answer and press **Send answer**; they are notified.

**After the lesson**

- **Lesson recap and homework:** write what you covered and any homework, and optionally paste a link to a recording. Leave *Notify the learners and parents* ticked. Learners find it under **Timetable → Past lessons**.
- **How well they understood** shows each learner's own rating from *Lost* to *Confident*, with anything they want explained again. Low ratings are highlighted so you know what to revisit.

Taking part earns learners small badges (asking a question, answering quick checks, checking in after lessons). There are no rankings between learners.

## Take attendance

Open the class (from the dashboard, the calendar, or **Classes → Attendance to complete**).

For each student choose **Present**, **Late**, **Absent** or **Excused**, adjust **Minutes taught** if the lesson ran short or long, add a note if useful, then **Save register**. The class is marked completed.

**How attendance affects billing (hourly students):**

- *Present* and *Late* are billed for the minutes taught, while **Billable** is ticked. Untick it for a lesson you are not charging for.
- *Excused* is never billed.
- *Absent* is **not** billed unless you have switched on *Bill unexcused absences* on that student's profile.

You can reopen a register and correct it any time before the invoice for that period is issued.

## Set and grade assignments

**Assignments → Create assignment**.

1. Enter a **title** and **instructions**.
2. Choose the **type**:
   - *Written assignment*: the student types an answer and/or uploads a file. You mark it.
   - *Multiple-choice quiz*: marked automatically.
   - *Timed practice*: a quiz with a time limit. The clock starts when the student opens the questions.
3. Set the **due date**, **total marks**, and whether **resubmissions** are allowed.
4. Optional: a **grading rubric**, one line each: `Method shown | 4`.
5. Tick the **students** and **Save draft**.

For a quiz, add questions on the next page: the question, the options (one per line), the number of the correct option, and the marks. Correct answers are kept on the server and never sent to students.

Press **Publish to students** when it is ready. Students are notified. *Unpublish* hides it again.

**Marking.** Open the assignment; submissions are listed with anything typed and a download button for uploads. Enter the **mark** and **feedback** and press **Save mark**. The family is notified. Quizzes arrive already marked; you can still adjust the mark and add feedback. Every mark and every change to a mark is recorded in the audit log.

If the AI assistant is switched on, **Draft feedback with AI** suggests wording for written work. It only fills the box; nothing is saved until you have read it, edited it and pressed save.

## Upload learning materials

**Resources → Upload a resource**.

1. Give it a **title**.
2. Choose who can open it:
   - **Private**: only the students you tick, or everyone enrolled on a programme you select, plus their parents.
   - **Public handout**: anyone with the link. Never use this for anything personal.
3. Choose the **file** (PDF, images, Word, PowerPoint, text) and wait for "Uploaded".
4. Tick students and/or choose a programme, then **Save resource**.

Use **Change sharing** on an existing resource to add or remove students. **Delete** removes the file as well.

## Generate a report

**Reports → New progress report**.

1. Choose the **student** and the **period**, then **Create draft**. Attendance and marked work for that period are filled in for you.
2. Write **Strengths**, **Areas for improvement**, **Teacher's comments**, **Learning targets** (one per line, measurable, e.g. "Score 70% or more on the next fractions quiz") and **Recommended next steps**. Press **Save report**. The preview on the right shows exactly what the family will see.
3. If records changed since you created the draft, tick *Refresh attendance and assessment figures* and save.
4. Press **Publish report**. The student and linked parents are notified and can read and print it.

**Print or save as PDF** opens your browser's print window; choose *Save as PDF* to keep a copy. *Return to draft* withdraws a published report.

**Certificates** are issued only when you choose: Reports → **Issue a certificate**, pick the student, enter the title and wording, and confirm. It appears in the student's and parents' portals and can be printed. *Withdraw* removes it.

## Issue an invoice

Invoices are always created as **drafts** so you can check them first. Families cannot see a draft.

### Monthly tuition for everyone

**Billing → Generate tuition invoices**. The period defaults to last month. Press **Create drafts**. One draft is created for each active student on hourly or flat monthly billing. Running it twice never creates duplicates.

This also happens automatically on the invoice day set in **Settings → Billing policy**; you get a notification that drafts are waiting.

### A single invoice

**Billing → Create invoice**. Choose the student, period and due date, then either tick *Add tuition from this student's billing settings*, or type your own lines, or both:

```
Revision workbook | 1 | 3500
Sibling discount | 1 | -2000
```

For term fees paid in parts, choose a number of **instalments**; the total is split into separate invoices due a month apart.

### Check and issue

Open a draft. Add or remove lines, set the due date, read the preview. When it is right, press **Issue invoice**. This locks the amounts, makes it visible to the family and notifies them. After issuing, an invoice cannot be edited: if it is wrong, cancel it (only possible if nothing has been paid) and create a new one.

## Reconcile a payment

**Online payments** (if Paystack is connected) need nothing from you. When a family pays, the system confirms the payment directly with Paystack, credits the invoice, adds a receipt and notifies you. Seeing a "success" screen is not treated as proof; only Paystack's confirmation is.

**Bank transfer or cash:**

1. Check your bank statement or cash received.
2. Open the invoice → **Record a payment**.
3. Choose **Bank transfer** or **Cash**, enter the **amount**, a **reference** (the transfer reference or your receipt number) and the **date received**.
4. Press **Record payment**.

The invoice becomes *Partially paid* or *Paid*, a receipt appears on it, and the family is told. The same reference cannot be entered twice on one invoice.

**If you make a mistake**, payments cannot be edited or deleted, so the record always shows what happened. Instead record an **Adjustment** for the difference: for example `-1000` if you entered 1,000 too much, with a note explaining why.

**Chasing.** **Billing** shows the total outstanding; filter by *Overdue*. Reminders go out automatically before the due date and weekly once overdue. **Send reminder** on an invoice sends one immediately.

## Send an announcement

**Announcements → New announcement**.

1. Write a **title** and **message**.
2. Choose who receives it: *All students and parents*, *All students*, *All parents*, or *Selected people*.
3. For *Selected people*, tick the names. Tick *Also include the parents of selected students* to reach whole families.
4. Tick *Also send by email* if you want an email as well as the in-app notice.
5. Press **Publish announcement**.

Only the people you chose can see it. *Remove* withdraws it for everyone.

## Publish a blog article

**Blog → New article**, type a title, **Start writing**.

1. Write the **summary** and the **article**. Formatting uses simple marks: `## Heading`, `**bold**`, `*italic*`, `- list item`, `> quote`, `[link text](https://…)`. Switch to **Preview** to see how it will look.
2. **Insert an image into the article**: choose a file and it is placed where your cursor is. Replace "Describe the image" with a short description.
3. On the right: add a **cover image**, choose a **layout** and **accent colour**, a **category** and **tags**.
4. Tick **Feature on the homepage** to show it on the front page.
5. Under **Search engines** you can adjust the web address and the title and description shown in search results.
6. **Save draft** as often as you like. Press **Publish** when ready. To publish later, set **Schedule for later** first.

After publishing, **Notify subscribers** emails the article to people who have signed up and confirmed. It can be sent once per article. **Export subscribers (CSV)** on the Blog page downloads the list with each person's consent date.

*Unpublish* returns an article to draft.

## Messages

**Messages** lists your private conversations, one per student or parent, with a count of unread messages. Start a new one from the list on the right, or press **Message** on a student's profile. You can attach a PDF or image.

Families are told they have a message, but the email never contains the message itself; they read it after signing in. Parents cannot read their child's conversation with you, and no family can see another's.

## Keeping the account safe

- Use a long password you do not use anywhere else, and keep two-step verification on.
- Sign out on shared computers (bottom of the menu).
- **Settings → Audit log** is a permanent record of important actions: approvals, grade changes, invoices issued or cancelled, payments recorded, settings changed. Nobody can edit or delete it.
- **Students → Export CSV** downloads student records. Keep exported files secure and delete them when finished.
- Never share your password or authenticator codes. Support staff will not ask for them.

## If something looks wrong

| What you see | What to do |
| --- | --- |
| "Set SUPABASE_SERVICE_ROLE_KEY…" when approving | Account creation is not connected. Ask whoever manages the hosting to add that setting. |
| Activation email not received | Check **Settings → Integrations → Email delivery**. Ask the family to check spam. Resend from the student's profile. |
| A family says their activation link has expired | Press **Send activation / password link** on the student's profile, or they can use *Forgot password* on the sign-in page. |
| A parent cannot see their child | Check the parent is listed under **Parents and guardians** on that student's profile. |
| "Online payment is not available" | Paystack is not connected. You can still record transfers and cash. |
| A page shows "Something went wrong" | Press **Try again**. If it repeats, note the reference shown on the page and pass it to whoever manages the hosting. |
| You lost your authenticator device | You will need help from whoever manages the Supabase project to reset two-step verification on your account. |
