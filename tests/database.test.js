const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const Database = require('better-sqlite3');
const { overlaps, slotIsAvailable, validateSlots } = require('../main/scheduling');
const { dueDateForMonth, overduePaymentMonths } = require('../main/payment-due');
const { openDatabase } = require('../main/database');

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
    const organizationColumns = new Set(db.pragma('table_info(organizations)').map(column => column.name));
    assert.ok(organizationColumns.has('payment_due_day'));
    const sessionColumns = new Set(db.pragma('table_info(sessions)').map(column => column.name));
    assert.ok(sessionColumns.has('hall_id'));
    assert.ok(sessionColumns.has('is_special'));
  } finally {
    db.close();
  }
});

test('opening an existing database migrates sessions for special-session fields', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tcms-schema-migration-'));
  const filePath = path.join(directory, 'legacy.db');
  const legacy = new Database(filePath);
  legacy.exec(`CREATE TABLE sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    session_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, session_date, start_time)
  );
  CREATE TABLE organizations (
    oid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE payment_due_dates (
    due_date_id INTEGER PRIMARY KEY AUTOINCREMENT,
    oid INTEGER NOT NULL REFERENCES organizations(oid),
    for_month TEXT NOT NULL,
    due_date TEXT NOT NULL,
    UNIQUE (oid, for_month)
  );
  INSERT INTO organizations (oid,name) VALUES (1,'Legacy Academy');
  INSERT INTO payment_due_dates (oid,for_month,due_date) VALUES
    (1,strftime('%Y-%m','now'),strftime('%Y-%m','now') || '-15')`);
  legacy.close();
  try {
    const upgraded = openDatabase(filePath);
    try {
      const columns = new Set(upgraded.pragma('table_info(sessions)').map(column => column.name));
      assert.ok(columns.has('hall_id'));
      assert.ok(columns.has('is_special'));
      assert.equal(upgraded.prepare('SELECT payment_due_day FROM organizations WHERE oid=1').get().payment_due_day, 15);
    } finally {
      upgraded.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
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

test('monthly due day repeats, clamps to month end, and warns only after it passes unpaid', () => {
  assert.equal(dueDateForMonth('2026-09', 10), '2026-09-10');
  assert.equal(dueDateForMonth('2026-02', 31), '2026-02-28');
  assert.equal(dueDateForMonth('2028-02', 31), '2028-02-29');
  assert.throws(() => dueDateForMonth('2026-09', 0), /between 1 and 31/);
  assert.throws(() => dueDateForMonth('2026-09', 32), /between 1 and 31/);
  assert.deepEqual(overduePaymentMonths('2026-09-01', [], 10, '2026-09-09'), []);
  assert.deepEqual(overduePaymentMonths('2026-09-01', [], 10, '2026-09-10'), [
    { month: '2026-09', due_date: '2026-09-10' }
  ]);
  assert.deepEqual(
    overduePaymentMonths('2026-01-01', ['2026-09'], 31, '2026-10-31'),
    [
      { month: '2026-01', due_date: '2026-01-31' },
      { month: '2026-02', due_date: '2026-02-28' },
      { month: '2026-03', due_date: '2026-03-31' },
      { month: '2026-04', due_date: '2026-04-30' },
      { month: '2026-05', due_date: '2026-05-31' },
      { month: '2026-06', due_date: '2026-06-30' },
      { month: '2026-07', due_date: '2026-07-31' },
      { month: '2026-08', due_date: '2026-08-31' },
      { month: '2026-10', due_date: '2026-10-31' }
    ]
  );
});

test('special sessions persist as one-time records with optional hall assignments', () => {
  const db = createDatabase();
  try {
    const { organization, classId } = seed(db);
    const hallId = db.prepare('INSERT INTO halls (oid,name) VALUES (?,?)').run(organization, 'Room A').lastInsertRowid;
    const addSession = db.prepare(`INSERT INTO sessions
      (class_id,session_date,start_time,end_time,hall_id,is_special) VALUES (?,?,?,?,?,1)`);
    addSession.run(classId, '2026-09-15', '17:00', '19:00', hallId);
    addSession.run(classId, '2026-09-20', '18:00', '20:00', null);
    const sessions = db.prepare('SELECT session_date,start_time,end_time,hall_id,is_special FROM sessions ORDER BY session_date').all();
    assert.deepEqual(sessions, [
      { session_date: '2026-09-15', start_time: '17:00', end_time: '19:00', hall_id: hallId, is_special: 1 },
      { session_date: '2026-09-20', start_time: '18:00', end_time: '20:00', hall_id: null, is_special: 1 }
    ]);
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
