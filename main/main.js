const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { openDatabase, getDatabase } = require('./database');
const { slotIsAvailable, validateSlots } = require('./scheduling');

let window;
let activeUser = null;
const dev = !app.isPackaged;
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString('hex')
});
const verifyPassword = (password, stored) => {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const validMonth = (month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const requireUser = () => {
  if (!activeUser) throw new Error('Please sign in to continue.');
  return activeUser;
};
const org = () => requireUser().oid;

function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 650,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const permitted = dev
      ? url.startsWith('http://127.0.0.1:5173/')
      : url.startsWith('file://');
    if (!permitted) event.preventDefault();
  });
  if (dev) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function scopedList(table, columns, orderBy) {
  return () => getDatabase().prepare(`SELECT ${columns} FROM ${table} WHERE oid = ? ORDER BY ${orderBy}`).all(org());
}

function registerIpc() {
  ipcMain.handle('auth:status', () => ({
    needsSetup: getDatabase().prepare('SELECT COUNT(*) AS count FROM users').get().count === 0,
    user: activeUser ? { username: activeUser.username, organization: activeUser.organization, role: activeUser.role } : null
  }));
  ipcMain.handle('auth:setup', (_event, input) => {
    const name = String(input.organization || '').trim();
    const username = String(input.username || '').trim();
    const password = String(input.password || '');
    if (!name || !username || password.length < 8) throw new Error('Enter an organization, username, and password of at least 8 characters.');
    const database = getDatabase();
    const create = database.transaction(() => {
      if (database.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new Error('Initial setup has already been completed. Sign in instead.');
      const result = database.prepare('INSERT INTO organizations (name, contact) VALUES (?, ?)').run(name, String(input.contact || '').trim());
      const credentials = hashPassword(password);
      const user = database.prepare('INSERT INTO users (oid, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
        result.lastInsertRowid, username, `${credentials.salt}:${credentials.hash}`, 'admin'
      );
      return { oid: result.lastInsertRowid, user_id: user.lastInsertRowid };
    });
    const created = create();
    activeUser = { ...created, username, organization: name, role: 'admin' };
    return { username, organization: name, role: 'admin' };
  });
  ipcMain.handle('auth:login', (_event, input) => {
    const username = String(input.username || '').trim();
    const user = getDatabase().prepare(
      'SELECT u.user_id, u.oid, u.username, u.password_hash, u.role, o.name AS organization FROM users u JOIN organizations o ON o.oid = u.oid WHERE u.username = ? COLLATE NOCASE'
    ).get(username);
    if (!user || !verifyPassword(String(input.password || ''), user.password_hash)) throw new Error('Username or password is incorrect.');
    activeUser = user;
    return { username: user.username, organization: user.organization, role: user.role };
  });
  ipcMain.handle('auth:logout', () => { activeUser = null; return true; });
  ipcMain.handle('dashboard:get', () => {
    const oid = org();
    const db = getDatabase();
    return {
      students: db.prepare("SELECT COUNT(*) AS count FROM students WHERE oid=? AND status='active'").get(oid).count,
      teachers: db.prepare('SELECT COUNT(*) AS count FROM teachers WHERE oid=?').get(oid).count,
      classes: db.prepare("SELECT COUNT(*) AS count FROM classes WHERE oid=? AND status='active'").get(oid).count,
      collected: db.prepare('SELECT COALESCE(SUM(p.amount_paid),0) AS amount FROM payments p JOIN class_enrollments e ON e.enrollment_id=p.enrollment_id JOIN classes c ON c.class_id=e.class_id WHERE c.oid=? AND p.for_month=?').get(oid, currentMonth()).amount,
      pending: getPendingTotal(oid, currentMonth()),
      sessions: db.prepare("SELECT s.session_id,s.session_date,s.start_time,s.end_time,s.status,c.class_name,c.subject FROM sessions s JOIN classes c ON c.class_id=s.class_id WHERE c.oid=? AND s.session_date=? AND s.status!='cancelled' ORDER BY s.start_time").all(oid, today()),
      lastBackup: db.prepare("SELECT created_at,file_path FROM backup_logs WHERE oid=? AND status='success' ORDER BY backup_id DESC LIMIT 1").get(oid) || null
    };
  });
  ipcMain.handle('students:list', scopedList('students', 'stid,rfid,name,school,contact1,contact2,birthday,address,status', 'name COLLATE NOCASE'));
  ipcMain.handle('students:save', (_event, input) => {
    const db = getDatabase();
    const values = [String(input.name || '').trim(), String(input.school || ''), String(input.contact1 || '').trim(), String(input.contact2 || ''), input.birthday || null, String(input.address || ''), input.status === 'inactive' ? 'inactive' : 'active'];
    if (!values[0] || !values[2]) throw new Error('Student name and primary contact are required.');
    if (input.stid) {
      const result = db.prepare('UPDATE students SET name=?,school=?,contact1=?,contact2=?,birthday=?,address=?,status=? WHERE stid=? AND oid=?').run(...values, input.stid, org());
      if (!result.changes) throw new Error('Student not found.');
      return input.stid;
    }
    return db.prepare('INSERT INTO students (oid,name,school,contact1,contact2,birthday,address,status) VALUES (?,?,?,?,?,?,?,?)').run(org(), ...values).lastInsertRowid;
  });
  ipcMain.handle('students:delete', (_event, stid) => {
    const result = getDatabase().prepare("UPDATE students SET status='inactive' WHERE stid=? AND oid=?").run(stid, org());
    if (!result.changes) throw new Error('Student not found.');
    return true;
  });
  ipcMain.handle('students:assignRfid', (_event, { stid, rfid, reassign }) => {
    const db = getDatabase();
    const id = Number(stid);
    const card = String(rfid || '').trim();
    if (!card) throw new Error('Scan or enter an RFID card number.');
    const student = db.prepare('SELECT stid FROM students WHERE stid=? AND oid=?').get(id, org());
    if (!student) throw new Error('Student not found.');
    const existing = db.prepare('SELECT stid,name FROM students WHERE rfid=? AND oid=?').get(card, org());
    if (!existing && db.prepare('SELECT 1 FROM students WHERE rfid=?').get(card)) {
      throw new Error('This card is already associated with a different organization.');
    }
    if (existing && existing.stid !== id && !reassign) return { conflict: existing.name };
    db.transaction(() => {
      if (existing && existing.stid !== id) db.prepare('UPDATE students SET rfid=NULL WHERE stid=? AND oid=?').run(existing.stid, org());
      db.prepare('UPDATE students SET rfid=? WHERE stid=? AND oid=?').run(card, id, org());
    })();
    return { success: true };
  });
  ipcMain.handle('students:removeRfid', (_event, stid) => getDatabase().prepare('UPDATE students SET rfid=NULL WHERE stid=? AND oid=?').run(stid, org()).changes > 0);
  ipcMain.handle('students:byRfid', (_event, rfid) => getDatabase().prepare('SELECT stid,name,rfid FROM students WHERE rfid=? AND oid=? AND status=?').get(String(rfid).trim(), org(), 'active') || null);
  ipcMain.handle('students:fees', (_event, stid) => {
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM students WHERE stid=? AND oid=?').get(stid, org())) throw new Error('Student not found.');
    const enrollments = db.prepare(`SELECT e.enrollment_id,e.enrolled_date,e.discount_percentage,c.class_name,c.fee
      FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id
      WHERE e.stid=? AND e.status='active' AND c.oid=? AND c.status='active' ORDER BY c.class_name`).all(stid, org());
    return enrollments.map(enrollment => ({
      ...enrollment,
      paid_months: db.prepare('SELECT for_month FROM payments WHERE enrollment_id=? AND for_month<=?').all(enrollment.enrollment_id, currentMonth()).map(payment => payment.for_month)
    }));
  });
  ipcMain.handle('teachers:list', scopedList('teachers', 'tid,name,contact,address,description', 'name COLLATE NOCASE'));
  ipcMain.handle('teachers:save', (_event, input) => {
    const db = getDatabase();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Teacher name is required.');
    const vals = [name, String(input.contact || ''), String(input.address || ''), String(input.description || '')];
    if (input.tid) {
      const result = db.prepare('UPDATE teachers SET name=?,contact=?,address=?,description=? WHERE tid=? AND oid=?').run(...vals, input.tid, org());
      if (!result.changes) throw new Error('Teacher not found.');
      return input.tid;
    }
    return db.prepare('INSERT INTO teachers (oid,name,contact,address,description) VALUES (?,?,?,?,?)').run(org(), ...vals).lastInsertRowid;
  });
  ipcMain.handle('teachers:delete', (_event, tid) => {
    const db = getDatabase();
    if (db.prepare('SELECT 1 FROM classes WHERE tid=? AND oid=? LIMIT 1').get(tid, org())) throw new Error('Move the teacher’s classes before removing this teacher.');
    return db.prepare('DELETE FROM teachers WHERE tid=? AND oid=?').run(tid, org()).changes > 0;
  });
  ipcMain.handle('halls:list', () => {
    const db = getDatabase();
    return db.prepare(`SELECT h.hall_id,h.name,h.capacity,
      (SELECT COUNT(*) FROM classes c WHERE c.hall_id=h.hall_id AND c.oid=h.oid) AS class_count
      FROM halls h WHERE h.oid=? ORDER BY h.name COLLATE NOCASE`).all(org())
      .map(hall => ({ ...hall, availability: db.prepare('SELECT availability_id,day_of_week,start_time,end_time FROM hall_availability WHERE hall_id=? ORDER BY day_of_week,start_time').all(hall.hall_id) }));
  });
  ipcMain.handle('halls:save', (_event, input) => {
    const db = getDatabase();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Hall name is required.');
    if (input.capacity && (!Number.isInteger(Number(input.capacity)) || Number(input.capacity) < 1)) throw new Error('Hall capacity must be a positive whole number.');
    const slots = Array.isArray(input.availability) ? input.availability : [];
    validateSlots(slots, 'Hall availability');
    const hallId = Number(input.hall_id || 0);
    if (hallId && !db.prepare('SELECT 1 FROM halls WHERE hall_id=? AND oid=?').get(hallId, org())) throw new Error('Hall not found.');
    if (hallId) {
      const scheduledClasses = db.prepare(`SELECT c.class_id,c.class_name,s.day_of_week,s.start_time,s.end_time
        FROM classes c JOIN class_schedules s ON s.class_id=c.class_id
        WHERE c.hall_id=? AND c.oid=? AND c.status='active'`).all(hallId, org());
      for (const scheduled of scheduledClasses) {
        if (!slotIsAvailable(scheduled, slots)) {
          throw new Error(`${scheduled.class_name} meets ${scheduled.day_of_week} ${scheduled.start_time}–${scheduled.end_time}, outside the proposed hall availability.`);
        }
      }
    }
    const save = db.transaction(() => {
      let id = hallId;
      if (id) db.prepare('UPDATE halls SET name=?,capacity=? WHERE hall_id=? AND oid=?').run(name, input.capacity || null, id, org());
      else id = db.prepare('INSERT INTO halls (oid,name,capacity) VALUES (?,?,?)').run(org(), name, input.capacity || null).lastInsertRowid;
      db.prepare('DELETE FROM hall_availability WHERE hall_id=?').run(id);
      const insert = db.prepare('INSERT INTO hall_availability (hall_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)');
      slots.forEach(slot => insert.run(id, slot.day_of_week, slot.start_time, slot.end_time));
      return id;
    });
    return save();
  });
  ipcMain.handle('halls:delete', (_event, hallId) => {
    const db = getDatabase();
    if (db.prepare('SELECT 1 FROM halls WHERE hall_id=? AND oid=?').get(hallId, org()) === undefined) throw new Error('Hall not found.');
    if (db.prepare('SELECT 1 FROM classes WHERE hall_id=? AND oid=? LIMIT 1').get(hallId, org())) throw new Error('This hall is assigned to a class. Remove or change that class’s hall first.');
    return db.prepare('DELETE FROM halls WHERE hall_id=? AND oid=?').run(hallId, org()).changes > 0;
  });
  ipcMain.handle('classes:list', () => getDatabase().prepare(`
    SELECT c.class_id,c.class_name,c.tid,c.subject,c.fee,c.teacher_commission_percentage,c.hall_id,c.status,t.name AS teacher_name,h.name AS hall_name,
      (SELECT COUNT(*) FROM class_enrollments e WHERE e.class_id=c.class_id AND e.status='active') AS student_count
    FROM classes c JOIN teachers t ON t.tid=c.tid LEFT JOIN halls h ON h.hall_id=c.hall_id
    WHERE c.oid=? ORDER BY c.class_name COLLATE NOCASE`).all(org()));
  ipcMain.handle('classes:detail', (_event, classId) => {
    const db = getDatabase();
    const c = db.prepare('SELECT * FROM classes WHERE class_id=? AND oid=?').get(classId, org());
    if (!c) throw new Error('Class not found.');
    return {
      ...c,
      schedules: db.prepare('SELECT schedule_id,day_of_week,start_time,end_time FROM class_schedules WHERE class_id=? ORDER BY schedule_id').all(classId),
      enrollments: db.prepare('SELECT e.enrollment_id,e.stid,e.discount_percentage,e.enrolled_date,e.status,s.name,s.rfid FROM class_enrollments e JOIN students s ON s.stid=e.stid WHERE e.class_id=? ORDER BY s.name').all(classId)
    };
  });
  ipcMain.handle('classes:save', (_event, input) => {
    const db = getDatabase();
    const name = String(input.class_name || '').trim();
    const tid = Number(input.tid);
    const fee = Number(input.fee);
    const commission = Number(input.teacher_commission_percentage);
    if (!name || !db.prepare('SELECT 1 FROM teachers WHERE tid=? AND oid=?').get(tid, org())) throw new Error('A class name and valid teacher are required.');
    if (input.hall_id && !db.prepare('SELECT 1 FROM halls WHERE hall_id=? AND oid=?').get(input.hall_id, org())) throw new Error('Choose a hall in this organization.');
    if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(commission) || commission < 0 || commission > 100) throw new Error('Enter a valid fee and commission from 0 to 100%.');
    const schedules = Array.isArray(input.schedules) ? input.schedules : [];
    validateSlots(schedules, 'Class schedule');
    if (input.hall_id && schedules.length) {
      const availability = db.prepare('SELECT day_of_week,start_time,end_time FROM hall_availability WHERE hall_id=?').all(input.hall_id);
      for (const slot of schedules) {
        if (!slotIsAvailable(slot, availability)) {
          throw new Error(`The hall is not available ${slot.day_of_week} ${slot.start_time}–${slot.end_time}. Update its availability or choose another hall.`);
        }
      }
      const classIdToIgnore = Number(input.class_id || 0);
      for (const slot of schedules) {
        const conflict = db.prepare(`SELECT c.class_name,s.start_time,s.end_time
          FROM classes c JOIN class_schedules s ON s.class_id=c.class_id
          WHERE c.hall_id=? AND c.oid=? AND c.status='active' AND c.class_id!=? AND s.day_of_week=?
            AND s.start_time<? AND s.end_time>? LIMIT 1`)
          .get(input.hall_id, org(), classIdToIgnore, slot.day_of_week, slot.end_time, slot.start_time);
        if (conflict) throw new Error(`${conflict.class_name} already uses this hall at ${conflict.start_time}–${conflict.end_time} on ${slot.day_of_week}.`);
      }
    }
    const save = db.transaction(() => {
      let classId = input.class_id;
      const vals = [name, tid, String(input.subject || ''), fee, commission, input.hall_id || null, input.status === 'inactive' ? 'inactive' : 'active'];
      if (classId) {
        if (!db.prepare('SELECT 1 FROM classes WHERE class_id=? AND oid=?').get(classId, org())) throw new Error('Class not found.');
        db.prepare('UPDATE classes SET class_name=?,tid=?,subject=?,fee=?,teacher_commission_percentage=?,hall_id=?,status=? WHERE class_id=? AND oid=?').run(...vals, classId, org());
        db.prepare('DELETE FROM class_schedules WHERE class_id=?').run(classId);
      } else {
        classId = db.prepare('INSERT INTO classes (oid,class_name,tid,subject,fee,teacher_commission_percentage,hall_id,status) VALUES (?,?,?,?,?,?,?,?)').run(org(), ...vals).lastInsertRowid;
      }
      const addSchedule = db.prepare('INSERT INTO class_schedules (class_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)');
      schedules.forEach(s => addSchedule.run(classId, s.day_of_week, s.start_time, s.end_time));
      return classId;
    });
    return save();
  });
  ipcMain.handle('classes:enroll', (_event, { class_id, students }) => {
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM classes WHERE class_id=? AND oid=?').get(class_id, org())) throw new Error('Class not found.');
    const enroll = db.prepare(`INSERT INTO class_enrollments (class_id,stid,discount_percentage) SELECT ?,stid,? FROM students WHERE stid=? AND oid=? AND status='active' ON CONFLICT(class_id,stid) DO UPDATE SET discount_percentage=excluded.discount_percentage,status='active'`);
    db.transaction(() => {
      for (const item of students || []) {
        const discount = Number(item.discount_percentage);
        if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Discount must be between 0 and 100%.');
        enroll.run(class_id, discount, item.stid, org());
      }
    })();
    return true;
  });
  ipcMain.handle('classes:dropEnrollment', (_event, enrollmentId) => {
    const result = getDatabase().prepare(`UPDATE class_enrollments SET status='dropped' WHERE enrollment_id=? AND class_id IN (SELECT class_id FROM classes WHERE oid=?)`).run(enrollmentId, org());
    return result.changes > 0;
  });
  ipcMain.handle('classes:updateDiscount', (_event, { enrollment_id, discount_percentage }) => {
    const discount = Number(discount_percentage);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Discount must be between 0 and 100%.');
    const result = getDatabase().prepare(`UPDATE class_enrollments SET discount_percentage=?
      WHERE enrollment_id=? AND status='active' AND class_id IN (SELECT class_id FROM classes WHERE oid=?)`).run(discount, enrollment_id, org());
    if (!result.changes) throw new Error('Active class enrolment not found.');
    return true;
  });
  ipcMain.handle('sessions:list', (_event, date = today()) => getDatabase().prepare(`
    SELECT s.session_id,s.class_id,s.session_date,s.start_time,s.end_time,s.status,c.class_name,c.subject,
      (SELECT COUNT(*) FROM attendance a WHERE a.session_id=s.session_id AND a.status='present') AS present_count,
      (SELECT COUNT(*) FROM attendance a WHERE a.session_id=s.session_id) AS roster_count
    FROM sessions s JOIN classes c ON c.class_id=s.class_id WHERE c.oid=? AND s.session_date=? ORDER BY s.start_time,c.class_name`).all(org(), date));
  ipcMain.handle('sessions:generate', (_event, date = today()) => {
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Enter a valid session date.');
    const db = getDatabase();
    const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const schedules = db.prepare(`SELECT s.class_id,s.start_time,s.end_time FROM class_schedules s JOIN classes c ON c.class_id=s.class_id WHERE c.oid=? AND c.status='active' AND s.day_of_week=?`).all(org(), day);
    const insert = db.prepare('INSERT OR IGNORE INTO sessions (class_id,session_date,start_time,end_time) VALUES (?,?,?,?)');
    let created = 0;
    db.transaction(() => schedules.forEach(s => { created += insert.run(s.class_id, date, s.start_time, s.end_time).changes; }))();
    return { created };
  });
  ipcMain.handle('sessions:attendance', (_event, sessionId) => {
    const db = getDatabase();
    const session = db.prepare('SELECT s.session_id,s.status,s.class_id,c.oid FROM sessions s JOIN classes c ON c.class_id=s.class_id WHERE s.session_id=? AND c.oid=?').get(sessionId, org());
    if (!session) throw new Error('Session not found.');
    return db.prepare(`SELECT a.attendance_id,a.stid,a.status,a.marked_at,s.name,s.rfid,e.enrollment_id,e.discount_percentage,c.fee,
      p.payment_id,p.amount_paid FROM attendance a JOIN students s ON s.stid=a.stid
      LEFT JOIN class_enrollments e ON e.class_id=? AND e.stid=a.stid
      LEFT JOIN classes c ON c.class_id=?
      LEFT JOIN payments p ON p.enrollment_id=e.enrollment_id AND p.for_month=?
      WHERE a.session_id=? ORDER BY s.name COLLATE NOCASE`).all(session.class_id, session.class_id, currentMonth(), sessionId);
  });
  ipcMain.handle('sessions:start', (_event, sessionId) => {
    const db = getDatabase();
    const session = db.prepare('SELECT s.session_id,s.class_id,s.status FROM sessions s JOIN classes c ON c.class_id=s.class_id WHERE s.session_id=? AND c.oid=?').get(sessionId, org());
    if (!session) throw new Error('Session not found.');
    if (session.status === 'completed' || session.status === 'cancelled') throw new Error('This session cannot be started.');
    db.transaction(() => {
      db.prepare(`INSERT OR IGNORE INTO attendance (session_id,stid,status) SELECT ?,stid,'not_marked' FROM class_enrollments WHERE class_id=? AND status='active'`).run(sessionId, session.class_id);
      db.prepare("UPDATE sessions SET status='ongoing' WHERE session_id=?").run(sessionId);
    })();
    return true;
  });
  ipcMain.handle('sessions:mark', (_event, { session_id, stid, status }) => {
    if (!['present','absent'].includes(status)) throw new Error('Attendance status must be present or absent.');
    const result = getDatabase().prepare(`UPDATE attendance SET status=?,marked_at=CURRENT_TIMESTAMP WHERE session_id=? AND stid=? AND session_id IN (SELECT s.session_id FROM sessions s JOIN classes c ON c.class_id=s.class_id WHERE c.oid=? AND s.status='ongoing')`).run(status, session_id, stid, org());
    if (!result.changes) throw new Error('Attendance could not be updated. Start the session first.');
    return true;
  });
  ipcMain.handle('sessions:end', (_event, sessionId) => {
    const db = getDatabase();
    const endSession = db.transaction(() => {
      const result = db.prepare(`UPDATE sessions SET status='completed' WHERE session_id=? AND status='ongoing' AND class_id IN (SELECT class_id FROM classes WHERE oid=?)`).run(sessionId, org());
      if (!result.changes) throw new Error('Only an ongoing session can be ended.');
      db.prepare("UPDATE attendance SET status='absent',marked_at=CURRENT_TIMESTAMP WHERE session_id=? AND status='not_marked'").run(sessionId);
    });
    endSession();
    return true;
  });
  ipcMain.handle('payments:overview', (_event, month = currentMonth()) => {
    if (!validMonth(month) || month > currentMonth()) throw new Error('Choose a payment month up to the current month.');
    const db = getDatabase();
    return {
      month,
      collected: db.prepare(`SELECT COALESCE(SUM(p.amount_paid),0) AS amount FROM payments p JOIN class_enrollments e ON e.enrollment_id=p.enrollment_id JOIN classes c ON c.class_id=e.class_id WHERE c.oid=? AND p.for_month=?`).get(org(), month).amount,
      due: getPendingTotal(org(), month),
      rows: db.prepare(`SELECT e.enrollment_id,e.stid,s.name,c.class_id,c.class_name,c.fee,e.discount_percentage,
        ROUND(c.fee*(1-e.discount_percentage/100.0),2) AS due_amount,p.payment_id,p.amount_paid,p.payment_date,p.payment_time,p.notes
        FROM class_enrollments e JOIN students s ON s.stid=e.stid JOIN classes c ON c.class_id=e.class_id
        LEFT JOIN payments p ON p.enrollment_id=e.enrollment_id AND p.for_month=?
        WHERE c.oid=? AND e.status='active' AND c.status='active' AND substr(e.enrolled_date,1,7)<=? ORDER BY s.name,c.class_name`).all(month, org(), month)
    };
  });
  ipcMain.handle('payments:pay', (_event, { enrollment_ids, month, session_id, notes }) => {
    if (!validMonth(month) || month > currentMonth()) throw new Error('Choose a payment month up to the current month.');
    const db = getDatabase();
    const uniqueIds = [...new Set((enrollment_ids || []).map(Number))];
    if (!uniqueIds.length) throw new Error('Select at least one unpaid class fee.');
    const rows = uniqueIds.map(id => db.prepare(`SELECT e.enrollment_id,e.class_id,e.enrolled_date,ROUND(c.fee*(1-e.discount_percentage/100.0),2) AS amount,c.oid
      FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.enrollment_id=? AND e.status='active' AND c.status='active'`).get(id));
    if (rows.some(row => !row || row.oid !== org())) throw new Error('One or more selected enrollments are unavailable.');
    if (rows.some(row => month < row.enrolled_date.slice(0, 7))) throw new Error('Payment cannot be recorded before the student enrolled.');
    if (session_id && rows.some(row => !db.prepare(`SELECT 1 FROM sessions s JOIN classes c ON c.class_id=s.class_id
      WHERE s.session_id=? AND s.class_id=? AND s.status='ongoing' AND c.oid=?`).get(session_id, row.class_id, org()))) {
      throw new Error('This session is not open for the selected class.');
    }
    const date = today();
    const time = new Date().toTimeString().slice(0, 8);
    const insert = db.prepare('INSERT INTO payments (enrollment_id,for_month,amount_paid,payment_date,payment_time,session_id,recorded_by,notes) VALUES (?,?,?,?,?,?,?,?)');
    db.transaction(() => rows.forEach(row => insert.run(row.enrollment_id, month, row.amount, date, time, session_id || null, requireUser().user_id, String(notes || ''))))();
    return true;
  });
  ipcMain.handle('students:payFees', (_event, items) => {
    if (!Array.isArray(items) || !items.length) throw new Error('Select at least one unpaid class month.');
    const db = getDatabase();
    const uniqueItems = [...new Map(items.map(item => [`${Number(item.enrollment_id)}:${item.month}`, item])).values()];
    const select = db.prepare(`SELECT e.enrollment_id,ROUND(c.fee*(1-e.discount_percentage/100.0),2) AS amount,c.oid,e.stid,e.enrolled_date
      FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.enrollment_id=? AND e.status='active'`);
    const rows = uniqueItems.map(item => {
      if (!validMonth(item.month) || item.month > currentMonth()) throw new Error('Choose a valid payment month up to the current month.');
      const row = select.get(Number(item.enrollment_id));
      if (!row || row.oid !== org()) throw new Error('One or more selected class enrolments are unavailable.');
      if (item.month < row.enrolled_date.slice(0, 7)) throw new Error('Payment cannot be recorded before the student enrolled.');
      return { ...row, month: item.month };
    });
    const insert = db.prepare('INSERT INTO payments (enrollment_id,for_month,amount_paid,payment_date,payment_time,recorded_by) VALUES (?,?,?,?,?,?)');
    const date = today(), time = new Date().toTimeString().slice(0, 8), userId = requireUser().user_id;
    db.transaction(() => rows.forEach(row => insert.run(row.enrollment_id, row.month, row.amount, date, time, userId)))();
    return true;
  });
  ipcMain.handle('reports:classEarnings', (_event, month = currentMonth()) => {
    if (!validMonth(month)) throw new Error('Enter a valid month.');
    return getDatabase().prepare(`
      SELECT c.class_id,c.class_name,t.tid,t.name AS teacher_name,c.fee,c.teacher_commission_percentage,
        COUNT(e.enrollment_id) AS enrolled_count,
        SUM(CASE WHEN p.payment_id IS NOT NULL THEN 1 ELSE 0 END) AS paid_students,
        SUM(CASE WHEN p.payment_id IS NULL THEN 1 ELSE 0 END) AS not_paid_students,
        COALESCE(SUM(p.amount_paid),0) AS collected,
        COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN ROUND(c.fee*(1-e.discount_percentage/100.0),2) ELSE 0 END),0) AS pending,
        COALESCE(SUM(p.amount_paid)*c.teacher_commission_percentage/100.0,0) AS teacher_earnings,
        COALESCE(SUM(p.amount_paid)*(100-c.teacher_commission_percentage)/100.0,0) AS org_earnings,
        COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN ROUND(ROUND(c.fee*(1-e.discount_percentage/100.0),2)*c.teacher_commission_percentage/100.0,2) ELSE 0 END),0) AS pending_teacher,
        COALESCE(SUM(CASE WHEN p.payment_id IS NULL THEN ROUND(c.fee*(1-e.discount_percentage/100.0),2)-ROUND(ROUND(c.fee*(1-e.discount_percentage/100.0),2)*c.teacher_commission_percentage/100.0,2) ELSE 0 END),0) AS pending_org
      FROM classes c JOIN teachers t ON t.tid=c.tid LEFT JOIN class_enrollments e ON e.class_id=c.class_id AND e.status='active'
      LEFT JOIN payments p ON p.enrollment_id=e.enrollment_id AND p.for_month=?
      WHERE c.oid=? AND c.status='active' GROUP BY c.class_id ORDER BY t.name,c.class_name`).all(month, org());
  });
  ipcMain.handle('reports:teacherBalances', () => getDatabase().prepare(`
    SELECT t.tid,t.name,
      COALESCE((SELECT SUM(p.amount_paid*c.teacher_commission_percentage/100.0)
        FROM payments p JOIN class_enrollments e ON e.enrollment_id=p.enrollment_id
        JOIN classes c ON c.class_id=e.class_id WHERE c.tid=t.tid AND c.oid=t.oid),0) AS earned,
      COALESCE((SELECT SUM(p.amount) FROM teacher_payouts p WHERE p.tid=t.tid),0) AS paid_out
    FROM teachers t WHERE t.oid=? ORDER BY t.name`).all(org()).map(row => ({ ...row, outstanding: money(row.earned - row.paid_out) })));
  ipcMain.handle('payouts:list', () => getDatabase().prepare(`SELECT p.payout_id,p.tid,t.name AS teacher_name,p.amount,p.payout_date,p.notes,
    (SELECT GROUP_CONCAT(c.class_name || ' · ' || COALESCE(d.for_month,'all months'), ', ') FROM teacher_payout_details d JOIN classes c ON c.class_id=d.class_id WHERE d.payout_id=p.payout_id) AS details
    FROM teacher_payouts p JOIN teachers t ON t.tid=p.tid WHERE t.oid=? ORDER BY p.payout_date DESC,p.payout_id DESC`).all(org()));
  ipcMain.handle('payouts:add', (_event, input) => {
    const db = getDatabase();
    const tid = Number(input.tid), amount = Number(input.amount);
    if (!db.prepare('SELECT 1 FROM teachers WHERE tid=? AND oid=?').get(tid, org()) || !Number.isFinite(amount) || amount <= 0) throw new Error('Choose a valid teacher and payout amount.');
    const details = Array.isArray(input.details) ? input.details : [];
    for (const detail of details) {
      if (!db.prepare('SELECT 1 FROM classes WHERE class_id=? AND tid=? AND oid=?').get(detail.class_id, tid, org())) throw new Error('Payout class does not belong to this teacher.');
      if (!Number.isFinite(Number(detail.amount_for_class)) || Number(detail.amount_for_class) < 0) throw new Error('Enter a valid class payout amount.');
    }
    const save = db.transaction(() => {
      const payoutId = db.prepare('INSERT INTO teacher_payouts (tid,amount,payout_date,notes) VALUES (?,?,?,?)').run(tid, amount, input.payout_date || today(), String(input.notes || '')).lastInsertRowid;
      const insert = db.prepare('INSERT INTO teacher_payout_details (payout_id,class_id,amount_for_class,for_month) VALUES (?,?,?,?)');
      details.forEach(d => insert.run(payoutId, d.class_id, Number(d.amount_for_class), d.for_month || null));
      return payoutId;
    });
    return save();
  });
  ipcMain.handle('settings:organization', () => getDatabase().prepare('SELECT name,contact FROM organizations WHERE oid=?').get(org()));
  ipcMain.handle('settings:saveOrganization', (_event, input) => {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Organization name is required.');
    const updated = getDatabase().prepare('UPDATE organizations SET name=?,contact=? WHERE oid=?').run(name, String(input.contact || ''), org()).changes > 0;
    if (updated) activeUser.organization = name;
    return updated;
  });
  ipcMain.handle('backup:create', async () => {
    const choice = await dialog.showSaveDialog(window, {
      title: 'Save tuition database backup',
      defaultPath: `tuition_backup_${today()}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.db`,
      filters: [{ name: 'SQLite database', extensions: ['db'] }]
    });
    if (choice.canceled || !choice.filePath) return { canceled: true };
    const destination = choice.filePath.endsWith('.db') ? choice.filePath : `${choice.filePath}.db`;
    try {
      await getDatabase().backup(destination);
      getDatabase().prepare('INSERT INTO backup_logs (oid,backup_type,file_path,status) VALUES (?,?,?,?)').run(org(), 'local', destination, 'success');
      return { path: destination };
    } catch (error) {
      getDatabase().prepare('INSERT INTO backup_logs (oid,backup_type,file_path,status) VALUES (?,?,?,?)').run(org(), 'local', destination, 'failed');
      throw error;
    }
  });
  ipcMain.handle('backup:restore', async () => {
    const choice = await dialog.showOpenDialog(window, { title: 'Choose a tuition database backup', properties: ['openFile'], filters: [{ name: 'SQLite database', extensions: ['db','sqlite','sqlite3'] }] });
    if (choice.canceled || !choice.filePaths[0]) return { canceled: true };
    const source = choice.filePaths[0];
    const Database = require('better-sqlite3');
    let candidate;
    try {
      candidate = new Database(source, { readonly: true, fileMustExist: true });
      const required = ['organizations','users','students','teachers','halls','hall_availability','classes','class_schedules','class_enrollments','sessions','attendance','payments','teacher_payouts','teacher_payout_details','backup_logs'];
      const tables = new Set(candidate.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
      if (required.some(table => !tables.has(table))) throw new Error('This file is not a valid Tuition Manager database backup.');
      if (candidate.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('This backup database is damaged and cannot be restored.');
      if (!candidate.prepare('SELECT 1 FROM organizations WHERE oid=?').get(org())) throw new Error('This backup does not contain your organization.');
      candidate.close();
      candidate = null;
      const db = getDatabase();
      db.pragma('wal_checkpoint(TRUNCATE)');
      const file = path.join(app.getPath('userData'), 'app.db');
      if (path.resolve(source).toLowerCase() === path.resolve(file).toLowerCase()) throw new Error('Choose a separate backup file, not the database currently in use.');
      const safetyCopy = `${file}.before-restore-${Date.now()}`;
      fs.copyFileSync(file, safetyCopy);
      const restoringUserId = activeUser.user_id;
      try {
        db.close();
        fs.copyFileSync(source, file);
        openDatabase(file);
        activeUser = getDatabase().prepare('SELECT u.user_id,u.oid,u.username,u.role,o.name AS organization FROM users u JOIN organizations o ON o.oid=u.oid WHERE u.user_id=?').get(restoringUserId);
        if (!activeUser) throw new Error('Restored backup no longer contains the signed-in account. Sign in again.');
        getDatabase().prepare('INSERT INTO backup_logs (oid,backup_type,file_path,status) VALUES (?,?,?,?)').run(org(), 'restore', source, 'success');
        fs.rmSync(safetyCopy, { force: true });
        return { restored: true };
      } catch (error) {
        try {
          if (getDatabase()) getDatabase().close();
        } catch {}
        fs.copyFileSync(safetyCopy, file);
        openDatabase(file);
        activeUser = getDatabase().prepare('SELECT u.user_id,u.oid,u.username,u.role,o.name AS organization FROM users u JOIN organizations o ON o.oid=u.oid WHERE u.user_id=?').get(restoringUserId);
        throw new Error(`Restore failed; the previous database was recovered. ${error.message}`);
      }
    } finally {
      if (candidate && candidate.open) candidate.close();
    }
  });
}

function getPendingTotal(oid, month) {
  const result = getDatabase().prepare(`SELECT COALESCE(SUM(ROUND(c.fee*(1-e.discount_percentage/100.0),2)),0) AS amount
    FROM class_enrollments e JOIN classes c ON c.class_id=e.class_id
    LEFT JOIN payments p ON p.enrollment_id=e.enrollment_id AND p.for_month=?
    WHERE c.oid=? AND c.status='active' AND e.status='active' AND substr(e.enrolled_date,1,7)<=? AND p.payment_id IS NULL`).get(month, oid, month);
  return money(result.amount);
}

app.whenReady().then(() => {
  openDatabase(path.join(app.getPath('userData'), 'app.db'));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
