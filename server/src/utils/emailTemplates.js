const { appUrl } = require('../config');

const SCHOOL = 'Global Virgins Montessori Academy';
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });
const money = (n) => naira.format(Number(n) || 0);

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FOOTER = `You are receiving this email because you have an account on the ${SCHOOL} portal. `
  + `You can turn off email notifications on your profile page: ${appUrl}/profile`;

// Wraps paragraphs (plain strings) and an optional button in the school email layout.
function render({ greeting, paragraphs, button }) {
  const text = [
    greeting,
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    ...(button ? [`${button.label}: ${button.url}`, ''] : []),
    `— ${SCHOOL}`,
    '',
    FOOTER,
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Arial,sans-serif;color:#1d2733">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:10px;border:1px solid #dde3ea">
<tr><td style="background:#1f5f8b;color:#fff;padding:16px 24px;border-radius:10px 10px 0 0;font-weight:600">${SCHOOL}</td></tr>
<tr><td style="padding:24px;line-height:1.55">
<p>${escape(greeting)}</p>
${paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}
${button ? `<p style="margin:24px 0"><a href="${escape(button.url)}" style="background:#1f5f8b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escape(button.label)}</a></p>` : ''}
<p>— ${SCHOOL}</p>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #dde3ea;color:#637083;font-size:12px">${escape(FOOTER)}</td></tr>
</table></td></tr></table></body></html>`;

  return { text, html };
}

exports.resultsPublished = ({ parent, student, term }) => ({
  subject: `${student.firstName}'s ${term.name} Term report card is ready`,
  ...render({
    greeting: `Dear ${parent.fullName},`,
    paragraphs: [
      `The ${term.name} Term (${term.AcademicSession.name}) results for ${student.firstName} ${student.lastName} have been published.`,
      'You can view and print the full report card, including scores, grades and teacher remarks, on the parent portal.',
    ],
    button: { label: 'View report card', url: `${appUrl}/report/${student.id}/${term.id}` },
  }),
});

exports.feeReminder = ({ parent, student, term, billed, paid, balance }) => ({
  subject: `School fees reminder for ${student.firstName} ${student.lastName}`,
  ...render({
    greeting: `Dear ${parent.fullName},`,
    paragraphs: [
      `This is a friendly reminder that ${student.firstName} ${student.lastName} has an outstanding balance for the ${term.name} Term (${term.AcademicSession.name}).`,
      `Total fees: ${money(billed)}. Paid so far: ${money(paid)}. Outstanding balance: ${money(balance)}.`,
      'Please contact the school office if you have already paid or would like to discuss a payment plan.',
    ],
    button: { label: 'View fee statement', url: `${appUrl}/students/${student.id}` },
  }),
});

exports.paymentReceived = ({ parent, student, payment, balance }) => ({
  subject: `Payment received – receipt ${payment.receiptNo}`,
  ...render({
    greeting: `Dear ${parent.fullName},`,
    paragraphs: [
      `We have received a payment of ${money(payment.amount)} for ${student.firstName} ${student.lastName}. Thank you.`,
      `Receipt number: ${payment.receiptNo}. ${balance > 0 ? `Outstanding balance for the term: ${money(balance)}.` : 'Fees for the term are now fully paid.'}`,
    ],
    button: { label: 'View receipt', url: `${appUrl}/receipt/${payment.id}` },
  }),
});

exports.passwordReset = ({ user, token, minutes }) => ({
  subject: 'Reset your school portal password',
  ...render({
    greeting: `Dear ${user.fullName},`,
    paragraphs: [
      'We received a request to reset the password for your account on the school portal.',
      `Use the button below to choose a new password. The link works once and expires in ${minutes} minutes.`,
      'If you did not ask for this, you can ignore this email. Your password will not change.',
    ],
    button: { label: 'Reset password', url: `${appUrl}/reset-password?token=${token}` },
  }),
});

exports.newMessage =({ recipient, sender, conversation, body }) => ({
  subject: `New message from ${sender.fullName}: ${conversation.subject}`,
  ...render({
    greeting: `Dear ${recipient.fullName},`,
    paragraphs: [
      `${sender.fullName} sent you a message on the school portal:`,
      ...body.split(/\n{2,}/),
      'Please reply on the portal rather than to this email.',
    ],
    button: { label: 'Read and reply', url: `${appUrl}/messages/${conversation.id}` },
  }),
});

exports.announcement = ({ user, announcement }) => ({
  subject: `School notice: ${announcement.title}`,
  ...render({
    greeting: `Dear ${user.fullName},`,
    paragraphs: announcement.body.split(/\n{2,}/),
    button: { label: 'Open the portal', url: `${appUrl}/announcements` },
  }),
});
