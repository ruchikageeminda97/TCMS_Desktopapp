const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const reportTime = value => {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
};

const reportTimestamp = value => {
  if (!value) return '';
  const parsed = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
};

function buildAttendanceReportHtml({ organization, session, students, generatedOn }) {
  const present = students.filter(student => student.status === 'present');
  const absent = students.filter(student => student.status === 'absent');
  const unmarked = students.filter(student => student.status === 'not_marked');
  const late = present.filter(student => Number(student.late_minutes) > 0);
  const studentList = (list, detailsFor, classFor) => list.length
    ? `<ol>${list.map(student => `<li class="${classFor ? classFor(student) : ''}">${escapeHtml(student.name)}${detailsFor ? `<small>${escapeHtml(detailsFor(student))}</small>` : ''}</li>`).join('')}</ol>`
    : '<p class="empty">None</p>';
  const time = [reportTime(session.start_time), reportTime(session.end_time)].filter(Boolean).join(' – ');
  const presentDetails = student => {
    const arrival = reportTimestamp(student.present_at);
    if (!arrival) return '';
    const lateness = Number(student.late_minutes);
    return session.class_started_at && lateness > 0
      ? `Arrived ${arrival} · ${lateness} minute${lateness === 1 ? '' : 's'} late`
      : `Arrived ${arrival}${session.class_started_at ? ' · On time' : ''}`;
  };
  const absentDetails = student => {
    const marked = reportTimestamp(student.marked_at);
    return marked ? `Marked absent ${marked}` : '';
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Attendance report - ${escapeHtml(session.class_name)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#252b37;margin:0;padding:36px}
    header{border-bottom:2px solid #7357dc;padding-bottom:18px;margin-bottom:22px}
    h1{font-size:25px;margin:0 0 6px}
    header p{color:#707887;margin:0}
    h2{font-size:17px;margin:24px 0 10px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 22px;margin:18px 0}
    .meta div{padding:10px 12px;background:#f6f5fa;border-radius:6px}
    .meta span{display:block;color:#747b89;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .meta b{font-size:14px}
    .counts{display:flex;gap:10px;margin:20px 0}
    .count{flex:1;padding:13px;border-radius:7px;background:#f6f5fa}
    .count b{display:block;font-size:21px;margin-bottom:3px}
    .count span{font-size:12px;color:#687080}
    .lists{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    section{border:1px solid #e6e8ed;border-radius:8px;padding:13px}
    section h2{margin:0 0 9px}
    ol{padding-left:23px;margin:0}
    li{padding:4px 0}
    li small{display:block;color:#687080;font-size:11px;margin-top:3px}
    li.late-arrival,li.late-arrival small{color:#b42318!important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .empty{color:#8d94a0;margin:0}
    .unmarked{margin-top:14px}
    footer{margin-top:26px;padding-top:10px;border-top:1px solid #e6e8ed;color:#8d94a0;font-size:11px}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <header>
    <h1>Attendance report</h1>
    <p>${escapeHtml(organization)}</p>
  </header>
  <div class="meta">
    <div><span>Class</span><b>${escapeHtml(session.class_name)}</b></div>
    <div><span>Teacher</span><b>${escapeHtml(session.teacher_name)}</b></div>
    <div><span>Session date</span><b>${escapeHtml(session.session_date)}</b></div>
    <div><span>Session time</span><b>${escapeHtml(time || 'Not set')}</b></div>
    <div><span>Register opened</span><b>${escapeHtml(reportTimestamp(session.register_opened_at) || 'Not recorded')}</b></div>
    <div><span>Class started</span><b>${escapeHtml(reportTimestamp(session.class_started_at) || 'Not recorded')}</b></div>
    <div><span>Session ended</span><b>${escapeHtml(reportTimestamp(session.ended_at) || 'Not recorded')}</b></div>
  </div>
  <div class="counts">
    <div class="count"><b>${students.length}</b><span>Enrolled students</span></div>
    <div class="count"><b>${present.length}</b><span>Present</span></div>
    <div class="count"><b>${absent.length}</b><span>Absent</span></div>
    <div class="count"><b>${late.length}</b><span>Arrived late</span></div>
  </div>
  <div class="lists">
    <section><h2>Present (${present.length})</h2>${studentList(present, presentDetails, student => Number(student.late_minutes) > 0 ? 'late-arrival' : '')}</section>
    <section><h2>Absent (${absent.length})</h2>${studentList(absent, absentDetails)}</section>
  </div>
  ${unmarked.length ? `<section class="unmarked"><h2>Not marked (${unmarked.length})</h2>${studentList(unmarked)}</section>` : ''}
  <footer>Generated ${escapeHtml(generatedOn)}</footer>
</body>
</html>`;
}

module.exports = { buildAttendanceReportHtml, reportTimestamp };
