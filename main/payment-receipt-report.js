const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

function buildPaymentReceiptHtml({ organization, receipt, rows, total }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment receipt ${escapeHtml(receipt.receipt_code)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#252b37;margin:0;padding:36px}
    header{border-bottom:2px solid #624bd0;padding-bottom:16px;margin-bottom:20px}
    h1{font-size:24px;margin:0 0 5px}
    header p{color:#687080;margin:0}
    .receipt-number{margin:20px 0;padding:14px;border:1px solid #dcd7f4;background:#f7f5ff;text-align:center}
    .receipt-number span,.details span{display:block;color:#687080;font-size:10px;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
    .receipt-number b{font-family:Consolas,monospace;font-size:25px;letter-spacing:3px}
    .details{display:flex;gap:36px;margin:18px 0}
    .details b{font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{padding:9px;border:1px solid #d8dbe2;text-align:left;font-size:12px}
    th{background:#f2f3f6;font-size:10px}
    td:last-child,th:last-child{text-align:right}
    .total{display:flex;justify-content:space-between;margin-top:14px;padding:12px;border-top:2px solid #343b49;font-size:15px}
    .total b{font-size:18px}
    footer{margin-top:26px;color:#7b8290;font-size:10px;text-align:center}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <header><h1>Payment receipt</h1><p>${escapeHtml(organization)}</p></header>
  <div class="receipt-number"><span>Receipt / barcode number</span><b>${escapeHtml(receipt.receipt_code)}</b></div>
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

module.exports = { buildPaymentReceiptHtml };
