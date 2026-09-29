# Change log

## 2026-09-27

### Student and teacher Excel records

- Added Excel (`.xlsx`) imports for student and teacher records. Imports validate the required columns and every row before writing; invalid workbooks are rejected without partially importing data.
- Added downloadable student and teacher templates. Student imports require `Name` and `Primary Contact`; teacher imports require `Name`. Optional fields are included in each template.
- Import files are limited to 20 MB and 5,000 records. Imported rows are added to the signed-in organization; they do not overwrite existing records.
- Added Excel import parsing and template regression tests. ExcelJS is used for workbook handling, with its UUID dependency pinned to a non-vulnerable version.

### Attendance, RFID, payments, and readability

- Attendance registers now detect a matching RFID card as it is scanned, mark the student present, and return focus to the scan box for the next card.
- Expanded the attendance dialog and added a student detail pane beside the register, with student contact/profile details and larger attendance/payment actions.
- Added a student selector to Payments. Selecting a student shows only their unpaid class fees for the chosen month and supports collecting those fees together.
- Refresh student records immediately after assigning or removing an RFID card so the student list no longer shows stale card data.
- Increased every fixed-pixel text size in the application stylesheet by 5 px.
- Reduced all fixed-pixel text sizes by 2 px in the follow-up readability adjustment. The net increase from the original text sizing is 3 px.
- Centered the student initials in the attendance detail avatar. The attendance payment action now shows **Mark as Paid** with the fee amount, prevents repeat submissions while saving, and is only enabled for present students in an open session.

### Navigation, reporting, and scheduling improvements

- Widened the desktop sidebar, increased navigation and button sizing, and raised contrast for secondary text, search fields, and secondary buttons.
- Added name/RFID search to student enrolment and capped list displays at eight records with pagination and search across student, teacher, class, hall, attendance, payment, and report lists.
- Added a payment review step with a **Revise selection** action before any fee is recorded.
- Added searchable student payment history with month, year, and class filters, complete teacher payout history, and PDF exports containing organization, student, class, teacher, date, amount, and pending-payment details.
- Added a pending-payment register at the bottom of Reports and a weekly hall calendar with red booked slots, class names, enrolment counts, and hall capacity.

## Previous delivery

- Established the Electron, React, and SQLite tuition-management application with organization-scoped sign-in and records.
- Added student, teacher, hall, class, enrollment, attendance, payment, reporting, payout, and local backup workflows.
- Added the most recent prior change: database schema, scheduling, fee, attendance, and Electron SQLite smoke-test coverage.
