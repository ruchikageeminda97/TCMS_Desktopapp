const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { createTemplateBuffer, parseExcelRecords } = require('../main/record-import');

async function workbookBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Records');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

test('student Excel import accepts aliases and normalizes records', async () => {
  const buffer = await workbookBuffer(
    ['Student Name', 'School', 'Contact 1', 'Contact 2', 'Date of Birth', 'Address', 'Status'],
    [['Alex Student', 'North School', '555-0100', '', new Date('2010-02-03T00:00:00Z'), 'Main St', 'ACTIVE']]
  );
  assert.deepEqual(await parseExcelRecords(buffer, 'students'), [{
    name: 'Alex Student',
    school: 'North School',
    contact1: '555-0100',
    contact2: '',
    birthday: '2010-02-03',
    address: 'Main St',
    status: 'active'
  }]);
});

test('teacher Excel import validates required names and supports optional fields', async () => {
  const buffer = await workbookBuffer(['Name', 'Phone', 'Address', 'About'], [['Taylor Teacher', '555-0110', '', 'Science']]);
  assert.deepEqual(await parseExcelRecords(buffer, 'teachers'), [{
    name: 'Taylor Teacher',
    contact: '555-0110',
    address: '',
    description: 'Science'
  }]);
  const invalid = await workbookBuffer(['Name', 'Phone'], [['', '555-0110']]);
  await assert.rejects(parseExcelRecords(invalid, 'teachers'), /Row 2: name is required/);
});

test('Excel import requires the student contact column and rejects invalid student rows', async () => {
  const noContact = await workbookBuffer(['Name'], [['Alex Student']]);
  await assert.rejects(parseExcelRecords(noContact, 'students'), /Missing required Excel column: Primary Contact/);
  const invalid = await workbookBuffer(['Name', 'Primary Contact', 'Status'], [['Alex Student', '', 'unknown']]);
  await assert.rejects(parseExcelRecords(invalid, 'students'), /primary contact is required/);
});

test('Excel template downloads as a valid workbook with the documented headers', async () => {
  const buffer = await createTemplateBuffer('students');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), [
    'Name', 'School', 'Primary Contact', 'Other Contact', 'Birthday', 'Address', 'Status'
  ]);
});
