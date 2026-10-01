const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

function buildClassPaymentReportHtml({ organization, year, classes, generatedOn }) {
  const classPages = classes.length
    ? classes.map((classRecord, classIndex) => `<section class="class-page${classIndex ? ' page-break' : ''}">
        <header>
          <p>${escapeHtml(organization)}</p>
          <h1>Annual Student Payment Register</h1>
          <div class="class-details">
            <span><b>Class:</b> ${escapeHtml(classRecord.class_name)}</span>
            <span><b>Teacher:</b> ${escapeHtml(classRecord.teacher_name)}</span>
            <span><b>Year:</b> ${escapeHtml(year)}</span>
          </div>
          <p class="marking-note">Mark each month when the student's payment is received.</p>
        </header>
        <table>
          <colgroup><col class="student-column">${MONTHS.map(() => '<col class="month-column">').join('')}</colgroup>
          <thead><tr><th>Student name</th>${MONTHS.map(month => `<th>${month}</th>`).join('')}</tr></thead>
          <tbody>${classRecord.students.length
            ? classRecord.students.map(student => `<tr><th scope="row">${escapeHtml(student.name)}</th>${MONTHS.map(() => '<td></td>').join('')}</tr>`).join('')
            : `<tr><td class="empty" colspan="13">No enrolled students in this class.</td></tr>`}</tbody>
        </table>
      </section>`).join('')
    : `<section class="class-page"><header><p>${escapeHtml(organization)}</p><h1>Annual Student Payment Register</h1><div class="class-details"><span><b>Year:</b> ${escapeHtml(year)}</span></div></header><p class="empty">There are no active classes to include in this report.</p></section>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Student payment register ${escapeHtml(year)}</title>
  <style>
    *{box-sizing:border-box}
    @page{size:A4 portrait;margin:9mm}
    body{font-family:Arial,sans-serif;color:#263044;margin:0}
    .class-page{width:100%}
    .page-break{break-before:page;page-break-before:always}
    header{border-bottom:2px solid #604bc0;padding-bottom:9px;margin-bottom:12px}
    header>p{margin:0 0 3px;color:#697386;font-size:10px}
    h1{margin:0 0 9px;color:#4934a6;font-size:18px}
    .class-details{display:flex;gap:24px;color:#303849;font-size:11px}
    .class-details b{color:#604bc0}
    .marking-note{margin:8px 0 0;color:#727b8c;font-size:9px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    .student-column{width:23%}
    .month-column{width:6.416%}
    th,td{border:1px solid #697386;height:7mm;padding:2px}
    thead th{height:8mm;background:#eeebfb;color:#4934a6;font-size:8px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead th:first-child{text-align:left}
    tbody th{font-size:8px;text-align:left;font-weight:600;color:#303849;overflow-wrap:anywhere}
    tbody td{background:#fff}
    .empty{padding:12px;color:#707887;text-align:center;font-size:11px}
    footer{position:fixed;bottom:0;right:0;color:#9299a6;font-size:8px}
    @media print{.class-page{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}}
  </style>
</head>
<body>
  ${classPages}
  <footer>Generated ${escapeHtml(generatedOn)}</footer>
</body>
</html>`;
}

module.exports = { buildClassPaymentReportHtml, MONTHS };
