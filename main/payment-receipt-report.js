const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const code39Patterns = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  '*': 'nwnnwnwnn'
};

function buildCode39Svg(value) {
  const characters = `*${value}*`;
  let cursor = 0;
  const bars = [];
  for (const character of characters) {
    const pattern = code39Patterns[character];
    if (!pattern) throw new Error('Receipt barcode contains unsupported characters.');
    [...pattern].forEach((unit, index) => {
      const width = unit === 'w' ? 3 : 1;
      if (index % 2 === 0) bars.push(`<rect x="${cursor}" y="0" width="${width}" height="44"/>`);
      cursor += width;
    });
    if (character !== characters[characters.length - 1]) cursor += 1;
  }
  return `<svg class="receipt-barcode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cursor} 44" role="img" aria-label="Code 39 barcode for receipt ${escapeHtml(value)}" shape-rendering="crispEdges">${bars.join('')}</svg>`;
}

function buildPaymentReceiptHtml({ organization, receipt, rows, total }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment receipt ${escapeHtml(receipt.receipt_code)}</title>
  <style>
    *{box-sizing:border-box}
    @page{size:A4;margin:8mm}
    body{font-family:Arial,sans-serif;color:#252b37;margin:0;padding:0;max-width:194mm}
    header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #624bd0;padding-bottom:5px;margin-bottom:6px}
    h1{font-size:13px;margin:0 0 2px}
    header p{color:#687080;margin:0;font-size:9px}
    .receipt-number{display:flex;align-items:center;flex-direction:column;gap:1px;flex:none;margin-top:-2px}
    .receipt-number b{font-family:Consolas,monospace;font-size:8px;letter-spacing:1px}
    .receipt-barcode{display:block;width:42mm;height:9mm;fill:#171923}
    .details{display:flex;gap:16px;margin:5px 0}
    .details span{display:block;color:#687080;font-size:7px;letter-spacing:.3px;margin-bottom:1px}
    .details b{font-size:8px}
    table{width:100%;border-collapse:collapse;margin-top:5px}
    th,td{padding:2px 4px;border:1px solid #d8dbe2;text-align:left;font-size:8px;line-height:1.1}
    th{background:#f2f3f6;font-size:7px}
    td:last-child,th:last-child{text-align:right}
    .total{display:flex;justify-content:space-between;margin-top:5px;padding:4px 5px;border-top:1px solid #343b49;font-size:9px}
    .total b{font-size:10px}
    footer{margin-top:5px;color:#7b8290;font-size:7px;text-align:center}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <header>
    <div><h1>Payment receipt</h1><p>${escapeHtml(organization)}</p></div>
    <div class="receipt-number"><b>${escapeHtml(receipt.receipt_code)}</b>${buildCode39Svg(receipt.receipt_code)}</div>
  </header>
  <div class="details">
    <div><span>Payment date</span><b>${escapeHtml(receipt.payment_date)}</b></div>
    <div><span>Payment time</span><b>${escapeHtml(receipt.payment_time)}</b></div>
  </div>
  <table>
    <thead><tr><th>Student</th><th>Class</th><th>For month</th><th>Amount paid</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td>${escapeHtml(row.student_name)}</td><td>${escapeHtml(row.class_name)}</td><td>${escapeHtml(row.for_month)}</td><td>${escapeHtml(Number(row.amount_paid).toFixed(2))}</td></tr>`).join('')}</tbody>
  </table>
  <div class="total"><span>Total paid</span><b>${escapeHtml(Number(total).toFixed(2))}</b></div>
  <footer>Thank you for your payment.</footer>
</body>
</html>`;
}

module.exports = { buildPaymentReceiptHtml, buildCode39Svg };
