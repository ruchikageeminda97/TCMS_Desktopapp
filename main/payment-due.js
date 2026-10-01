function dueDateForMonth(month, dueDay) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Enter a valid payment month.');
  }
  const day = Number(dueDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error('Payment due day must be between 1 and 31.');
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function overduePaymentMonths(enrolledDate, paidMonths, dueDay, asOfDate) {
  if (!dueDay || !enrolledDate || !/^\d{4}-\d{2}-\d{2}$/.test(enrolledDate)) return [];
  const paid = new Set(paidMonths);
  const overdue = [];
  const currentMonth = asOfDate.slice(0, 7);
  const [year, monthNumber] = enrolledDate.slice(0, 7).split('-').map(Number);
  const cursor = new Date(Date.UTC(year, monthNumber - 1, 1));
  while (cursor.toISOString().slice(0, 7) <= currentMonth) {
    const month = cursor.toISOString().slice(0, 7);
    const dueDate = dueDateForMonth(month, dueDay);
    if (dueDate <= asOfDate && !paid.has(month)) overdue.push({ month, due_date: dueDate });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return overdue;
}

module.exports = { dueDateForMonth, overduePaymentMonths };
