const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { overlaps, slotIsAvailable, validateSlots } = require('../main/scheduling');

function createDatabase() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'main', 'schema.sql'), 'utf8'));
  return db;
}

function seed(db) {
  const organization = db.prepare('INSERT INTO organizations (name) VALUES (?)').run('Bright Academy').lastInsertRowid;
  const teacher = db.prepare('INSERT INTO teachers (oid,name) VALUES (?,?)').run(organization, 'Alex Teacher').lastInsertRowid;
  const student = db.prepare('INSERT INTO students (oid,name,contact1) VALUES (?,?,?)').run(organization, 'Jamie Student', '555-0100').lastInsertRowid;
  const classId = db.prepare('INSERT INTO classes (oid,class_name,tid,fee,teacher_commission_percentage) VALUES (?,?,?,?,?)').run(organization, 'Maths', teacher, 1000, 80).lastInsertRowid;
  const enrollment = db.prepare('INSERT INTO class_enrollments (class_id,stid,discount_percentage) VALUES (?,?,?)').run(classId, student, 50).lastInsertRowid;
  return { organization, teacher, student, classId, enrollment };
}

test('schema creates the full tenant-scoped tuition management data model', () => {
  const db = createDatabase();
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    for (const table of ['organizations', 'users', 'students', 'teachers', 'halls', 'hall_availability', 'classes', 'class_schedules', 'class_enrollments', 'sessions', 'attendance', 'payments', 'teacher_payouts', 'teacher_payout_details', 'backup_logs']) {
      assert.ok(tables.has(table), `missing ${table}`);
    }
  } finally {
    db.close();
  }
});

test('hall availability must cover a class timeslot and reject overlapping bookings', () => {
  const availability = [
    { day_of_week: 'monday', start_time: '09:00', end_time: '12:00' },
    { day_of_week: 'wednesday', start_time: '13:00', end_time: '16:00' }
  ];
  assert.equal(slotIsAvailable({ day_of_week: 'monday', start_time: '10:00', end_time: '11:00' }, availability), true);
  assert.equal(slotIsAvailable({ day_of_week: 'monday', start_time: '11:30', end_time: '12:30' }, availability), false);
  assert.equal(slotIsAvailable({ day_of_week: 'tuesday', start_time: '10:00', end_time: '11:00' }, availability), false);
  assert.equal(overlaps('09:00', '10:30', '10:00', '11:00'), true);
  assert.equal(overlaps('09:00', '10:00', '10:00', '11:00'), false);
  assert.throws(() => validateSlots([
    { day_of_week: 'friday', start_time: '09:00', end_time: '10:00' },
    { day_of_week: 'friday', start_time: '09:30', end_time: '11:00' }
  ], 'Hall availability'), /overlapping times/);
});

test('editing a hall cannot remove an assigned class time from its availability', () => {
  const db = createDatabase();
  try {
    const { organization, classId } = seed(db);
    const hallId = db.prepare('INSERT INTO halls (oid,name) VALUES (?,?)').run(organization, 'Room A').lastInsertRowid;
    db.prepare('INSERT INTO classes (class_id,oid,class_name,tid,fee,hall_id) VALUES (?,?,?,?,?,?)')
      .run(classId + 1, organization, 'Science', db.prepare('SELECT tid FROM classes WHERE class_id=?').get(classId).tid, 1000, hallId);
    db.prepare('INSERT INTO class_schedules (class_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)')
      .run(classId + 1, 'monday', '10:00', '11:00');
    const assignedTimes = db.prepare(`SELECT s.day_of_week,s.start_time,s.end_time
      FROM classes c JOIN class_schedules s ON s.class_id=c.class_id WHERE c.hall_id=?`).all(hallId);
    assert.equal(assignedTimes.length, 1);
    assert.equal(slotIsAvailable(assignedTimes[0], [{ day_of_week: 'monday', start_time: '09:00', end_time: '11:00' }]), true);
    assert.equal(slotIsAvailable(assignedTimes[0], [{ day_of_week: 'monday', start_time: '09:00', end_time: '10:30' }]), false);
  } finally {
    db.close();
  }
});

test('enrolments upsert discounts and monthly payments use the discounted fee only once', () => {
  const db = createDatabase();
  try {
    const { organization, classId, student } = seed(db);
    const upsert = db.prepare(`INSERT INTO class_enrollments (class_id,stid,discount_percentage)
      SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM students WHERE stid=? AND oid=?)
      ON CONFLICT(class_id,stid) DO UPDATE SET discount_percentage=excluded.discount_percentage,status='active'`);
    upsert.run(classId, student, 50, student, organization);
    const enrollment = db.prepare('SELECT enrollment_id,discount_percentage FROM class_enrollments WHERE class_id=? AND stid=?').get(classId, student);
    assert.equal(enrollment.discount_percentage, 50);

    const amount = db.prepare('SELECT ROUND(c.fee*(1-e.discount_percentage/100.0),2) AS due FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.enrollment_id=?').get(enrollment.enrollment_id).due;
    assert.equal(amount, 500);
    const addPayment = db.prepare('INSERT INTO payments (enrollment_id,for_month,amount_paid,payment_date,payment_time) VALUES (?,?,?,?,?)');
    addPayment.run(enrollment.enrollment_id, '2026-09', amount, '2026-09-01', '09:30:00');
    assert.throws(() => addPayment.run(enrollment.enrollment_id, '2026-09', amount, '2026-09-02', '10:00:00'), /UNIQUE constraint failed/);
    assert.equal(db.prepare('SELECT SUM(amount_paid) AS total FROM payments WHERE for_month=?').get('2026-09').total, 500);
  } finally {
    db.close();
  }
});

test('tenant-scoped lookups cannot select another organization’s student', () => {
  const db = createDatabase();
  try {
    const first = seed(db);
    const otherOrg = db.prepare('INSERT INTO organizations (name) VALUES (?)').run('Other Academy').lastInsertRowid;
    const otherStudent = db.prepare('INSERT INTO students (oid,name,contact1,rfid) VALUES (?,?,?,?)').run(otherOrg, 'Private Student', '555-0101', 'CARD-1').lastInsertRowid;
    assert.equal(db.prepare('SELECT stid FROM students WHERE rfid=? AND oid=?').get('CARD-1', first.organization), undefined);
    assert.equal(db.prepare('SELECT stid FROM students WHERE rfid=? AND oid=?').get('CARD-1', otherOrg).stid, otherStudent);
    assert.throws(() => db.prepare('UPDATE students SET rfid=? WHERE stid=?').run('CARD-1', first.student), /UNIQUE constraint failed/);
  } finally {
    db.close();
  }
});

test('sessions generate attendance rows and preserve absent/present register states', () => {
  const db = createDatabase();
  try {
    const { classId, student } = seed(db);
    const sessionId = db.prepare('INSERT INTO sessions (class_id,session_date,start_time) VALUES (?,?,?)').run(classId, '2026-09-26', '09:00').lastInsertRowid;
    db.prepare('INSERT INTO attendance (session_id,stid) VALUES (?,?)').run(sessionId, student);
    db.prepare("UPDATE attendance SET status='present' WHERE session_id=? AND stid=?").run(sessionId, student);
    assert.equal(db.prepare('SELECT status FROM attendance WHERE session_id=? AND stid=?').get(sessionId, student).status, 'present');
    assert.throws(() => db.prepare('INSERT INTO attendance (session_id,stid) VALUES (?,?)').run(sessionId, student), /UNIQUE constraint failed/);
  } finally {
    db.close();
  }
});

test('monthly earnings split collected and discounted outstanding fees correctly', () => {
  const db = createDatabase();
  try {
    const { organization, classId, student, enrollment, teacher } = seed(db);
    const secondStudent = db.prepare('INSERT INTO students (oid,name,contact1) VALUES (?,?,?)').run(organization, 'Taylor Student', '555-0102').lastInsertRowid;
    const secondEnrollment = db.prepare('INSERT INTO class_enrollments (class_id,stid,discount_percentage) VALUES (?,?,?)').run(classId, secondStudent, 0).lastInsertRowid;
    db.prepare('INSERT INTO payments (enrollment_id,for_month,amount_paid,payment_date,payment_time) VALUES (?,?,?,?,?)').run(enrollment, '2026-09', 500, '2026-09-01', '09:00:00');

    const result = db.prepare(`SELECT c.class_id,t.tid,COUNT(e.enrollment_id) AS enrolled_count,
      SUM(CASE WHEN p.payment_id IS NOT NULL THEN 1 ELSE 0 END) AS paid_students,
      SUM(CASE WHEN p.payment_id IS NULL THEN 1 ELSE 0 END) AS not_paid_students,
      COALESCE(SUM(p.amount_paid),0) AS collected,
      COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN c.fee*(1-e.discount_percentage/100.0) ELSE 0 END),0) AS pending,
      COALESCE(SUM(p.amount_paid)*c.teacher_commission_percentage/100.0,0) AS teacher_earnings,
      COALESCE(SUM(p.amount_paid)*(100-c.teacher_commission_percentage)/100.0,0) AS org_earnings,
      COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN c.fee*(1-e.discount_percentage/100.0) ELSE 0 END)*c.teacher_commission_percentage/100.0,0) AS pending_teacher,
      COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN c.fee*(1-e.discount_percentage/100.0) ELSE 0 END)*(100-c.teacher_commission_percentage)/100.0,0) AS pending_org
      FROM classes c JOIN teachers t ON t.tid=c.tid
      LEFT JOIN class_enrollments e ON e.class_id=c.class_id AND e.status='active'
      LEFT JOIN payments p ON p.enrollment_id=e.enrollment_id AND p.for_month=?
      WHERE c.class_id=? AND c.oid=? GROUP BY c.class_id`).get('2026-09', classId, organization);

    assert.equal(result.tid, teacher);
    assert.equal(result.enrolled_count, 2);
    assert.equal(result.paid_students, 1);
    assert.equal(result.not_paid_students, 1);
    assert.equal(result.collected, 500);
    assert.equal(result.pending, 1000);
    assert.equal(result.teacher_earnings, 400);
    assert.equal(result.org_earnings, 100);
    assert.equal(result.pending_teacher, 800);
    assert.equal(result.pending_org, 200);
    assert.equal(db.prepare('SELECT enrollment_id FROM class_enrollments WHERE enrollment_id=?').get(secondEnrollment).enrollment_id, secondEnrollment);
  } finally {
    db.close();
  }
});

test('per-student discount editing updates payable tuition and both commission shares', () => {
  const db = createDatabase();
  try {
    const { organization, enrollment } = seed(db);
    const update = db.prepare(`UPDATE class_enrollments SET discount_percentage=?
      WHERE enrollment_id=? AND class_id IN (SELECT class_id FROM classes WHERE oid=?)`);
    assert.equal(update.run(50, enrollment, organization).changes, 1);
    const result = db.prepare(`SELECT c.fee*(1-e.discount_percentage/100.0) AS payable,
      c.fee*(1-e.discount_percentage/100.0)*c.teacher_commission_percentage/100.0 AS teacher_share,
      c.fee*(1-e.discount_percentage/100.0)*(100-c.teacher_commission_percentage)/100.0 AS organization_share
      FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.enrollment_id=?`).get(enrollment);
    assert.deepEqual(result, { payable: 500, teacher_share: 400, organization_share: 100 });
  } finally {
    db.close();
  }
});
