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

module.exports = { recordPaymentReceipt };
