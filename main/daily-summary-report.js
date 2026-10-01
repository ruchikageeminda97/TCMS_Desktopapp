const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const amount = value => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateLabel = value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? escapeHtml(value)
    : escapeHtml(parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }));
};

function buildDailySummaryReportHtml({ organization, date, activeStudentCount, totalReceived, totalTeacherPayouts, classPayments, teacherPayouts, sessions, generatedOn }) {
  const totalEnrolled = sessions.reduce((sum, session) => sum + Number(session.enrolled_count || 0), 0);
  const totalPresent = sessions.reduce((sum, session) => sum + Number(session.present_count || 0), 0);
  const totalAbsent = sessions.reduce((sum, session) => sum + Number(session.absent_count || 0), 0);
  const totalNotMarked = sessions.reduce((sum, session) => sum + Number(session.not_marked_count || 0), 0);
  const table = (headers, rows, empty) => rows.length
    ? `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
    : `<p class="empty">${escapeHtml(empty)}</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Daily summary - ${dateLabel(date)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#263044;margin:0;padding:34px}
    header{border-bottom:3px solid #7255d7;padding-bottom:16px;margin-bottom:20px}
    h1{font-size:26px;margin:0 0 6px;color:#4934a6}
    header p{margin:0;color:#71798a}
    header strong{display:block;margin-top:10px;color:#536178}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}
    .metric{padding:14px;border-radius:8px;background:#f1efff;border-top:3px solid #7255d7}
    .metric:nth-child(2){background:#eaf8f2;border-color:#278566}
    .metric:nth-child(3){background:#fff5e8;border-color:#d58a24}
    .metric:nth-child(4){background:#eaf4ff;border-color:#3480c4}
    .metric:nth-child(5){background:#fff0ef;border-color:#c54d4d}
    .metric:nth-child(6){background:#f2f3f6;border-color:#71798a}
    .metric span{display:block;color:#687286;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.45px}
    .metric b{display:block;margin-top:8px;font-size:22px;color:#4934a6}
    .metric:nth-child(2) b{color:#16724f}.metric:nth-child(3) b{color:#a96009}
    .metric:nth-child(4) b{color:#2169a6}.metric:nth-child(5) b{color:#a93232}
    h2{margin:23px 0 9px;font-size:17px;color:#4934a6;border-left:4px solid #7255d7;padding-left:9px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;background:#f0effa;color:#5644a0;padding:9px}
    td{padding:8px 9px;border-bottom:1px solid #e9ebf0;color:#354052}
    tr:nth-child(even) td{background:#fafaff}
    td.amount{text-align:right;font-weight:700;color:#187452}
    .empty{padding:10px;color:#828a99;background:#f7f8fa;border-radius:6px}
    .session-status{font-weight:700;color:#236c4f}
    footer{margin-top:26px;padding-top:10px;border-top:1px solid #e4e7ed;color:#818999;font-size:10px}
    @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
  <header>
    <h1>Daily Summary Report</h1>
    <p>${escapeHtml(organization)}</p>
    <strong>${dateLabel(date)}</strong>
  </header>
  <div class="metrics">
    <div class="metric"><span>Total amount received</span><b>${amount(totalReceived)}</b></div>
    <div class="metric"><span>Paid to teachers</span><b>${amount(totalTeacherPayouts)}</b></div>
    <div class="metric"><span>Active students</span><b>${Number(activeStudentCount || 0)}</b></div>
    <div class="metric"><span>Students enrolled in sessions</span><b>${totalEnrolled}</b></div>
    <div class="metric"><span>Present / absent</span><b>${totalPresent} / ${totalAbsent}</b></div>
    <div class="metric"><span>Sessions today</span><b>${sessions.length}</b></div>
  </div>
  <h2>Class payments received</h2>
  ${table(['Class', 'Teacher', 'Students paid', 'Amount received'], classPayments.map(row =>
    `<tr><td>${escapeHtml(row.class_name)}</td><td>${escapeHtml(row.teacher_name)}</td><td>${Number(row.student_count)}</td><td class="amount">${amount(row.amount_received)}</td></tr>`
  ), 'No student payments were recorded on this date.')}
  <h2>Teacher payouts</h2>
  ${table(['Teacher', 'Amount paid'], teacherPayouts.map(row =>
    `<tr><td>${escapeHtml(row.teacher_name)}</td><td class="amount">${amount(row.amount)}</td></tr>`
  ), 'No teacher payouts were recorded on this date.')}
  <h2>Sessions and attendance</h2>
  ${table(['Class', 'Teacher', 'Time', 'Enrolled', 'Present', 'Absent', 'Not marked', 'Status'], sessions.map(row =>
    `<tr><td>${escapeHtml(row.class_name)}</td><td>${escapeHtml(row.teacher_name)}</td><td>${escapeHtml([row.start_time, row.end_time].filter(Boolean).join('–') || 'Not set')}</td><td>${Number(row.enrolled_count)}</td><td>${Number(row.present_count)}</td><td>${Number(row.absent_count)}</td><td>${Number(row.not_marked_count)}</td><td class="session-status">${escapeHtml(row.status)}</td></tr>`
  ), 'No sessions were scheduled for this date.')}
  ${totalNotMarked ? `<p class="empty">${totalNotMarked} session attendance record${totalNotMarked === 1 ? ' is' : 's are'} still unmarked.</p>` : ''}
  <footer>Generated ${dateLabel(generatedOn)}</footer>
</body>
</html>`;
}

module.exports = { buildDailySummaryReportHtml };
