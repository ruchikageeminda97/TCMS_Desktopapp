function recordPaymentReceipt(db, oid, rows, { date, time, userId, sessionId = null, notes = null }) {
  const transaction = db.transaction(() => {
    const receiptId = db.prepare('INSERT INTO payment_receipts (oid,payment_date,payment_time,recorded_by) VALUES (?,?,?,?)')
      .run(oid, date, time, userId).lastInsertRowid;
    const receiptCode = String(receiptId).padStart(8, '0');
    if (receiptCode.length > 8) throw new Error('Payment receipt number limit reached.');
    db.prepare('UPDATE payment_receipts SET receipt_code=? WHERE receipt_id=?').run(receiptCode, receiptId);
    const insert = db.prepare(`INSERT INTO payments
      (enrollment_id,receipt_id,for_month,amount_paid,payment_date,payment_time,session_id,recorded_by,notes)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    rows.forEach(row => insert.run(
      row.enrollment_id, receiptId, row.for_month, row.amount, date, time, sessionId, userId, notes
    ));
    return { receipt_id: receiptId, receipt_code: receiptCode, payment_date: date, payment_time: time };
  });
  return transaction();
}

function listRecentPaymentReceipts(db, oid) {
  return db.prepare(`SELECT r.receipt_id,r.receipt_code,r.payment_date,r.payment_time,
      COUNT(p.payment_id) AS class_count,COALESCE(SUM(p.amount_paid),0) AS total,
      GROUP_CONCAT(DISTINCT s.name) AS student_names
    FROM payment_receipts r
    JOIN payments p ON p.receipt_id=r.receipt_id
    JOIN class_enrollments e ON e.enrollment_id=p.enrollment_id
    JOIN students s ON s.stid=e.stid
    JOIN classes c ON c.class_id=e.class_id
    WHERE r.oid=? AND c.oid=? AND s.oid=c.oid
    GROUP BY r.receipt_id
    ORDER BY r.payment_date DESC,r.payment_time DESC,r.receipt_id DESC
    LIMIT 4`).all(oid, oid).map(receipt => ({
      ...receipt,
      total: Math.round((Number(receipt.total) + Number.EPSILON) * 100) / 100
    }));
}

module.exports = { recordPaymentReceipt, listRecentPaymentReceipts };
