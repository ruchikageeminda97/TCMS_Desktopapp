const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('tuition', Object.freeze({
  auth: {
    status: invoke('auth:status'), setup: invoke('auth:setup'),
    login: invoke('auth:login'), logout: invoke('auth:logout')
  },
  dashboard: { get: invoke('dashboard:get') },
  students: {
    list: invoke('students:list'), save: invoke('students:save'), delete: invoke('students:delete'),
    assignRfid: invoke('students:assignRfid'), removeRfid: invoke('students:removeRfid'), byRfid: invoke('students:byRfid'),
    fees: invoke('students:fees'), payFees: invoke('students:payFees'),
    importExcel: () => ipcRenderer.invoke('records:import', 'students'),
    downloadTemplate: () => ipcRenderer.invoke('records:downloadTemplate', 'students')
  },
  teachers: {
    list: invoke('teachers:list'), save: invoke('teachers:save'), delete: invoke('teachers:delete'),
    importExcel: () => ipcRenderer.invoke('records:import', 'teachers'),
    downloadTemplate: () => ipcRenderer.invoke('records:downloadTemplate', 'teachers')
  },
  halls: { list: invoke('halls:list'), save: invoke('halls:save'), delete: invoke('halls:delete') },
  classes: {
    list: invoke('classes:list'), detail: invoke('classes:detail'), save: invoke('classes:save'),
    enroll: invoke('classes:enroll'), dropEnrollment: invoke('classes:dropEnrollment'),
    updateDiscount: invoke('classes:updateDiscount')
  },
  sessions: {
    list: invoke('sessions:list'), generate: invoke('sessions:generate'), attendance: invoke('sessions:attendance'),
    scheduleSpecial: invoke('sessions:scheduleSpecial'),
    start: invoke('sessions:start'), mark: invoke('sessions:mark'), end: invoke('sessions:end')
  },
  payments: { overview: invoke('payments:overview'), pay: invoke('payments:pay') },
  reports: {
    classEarnings: invoke('reports:classEarnings'),
    teacherBalances: invoke('reports:teacherBalances'),
    paymentRecords: invoke('reports:paymentRecords'),
    studentAttendance: invoke('reports:studentAttendance'),
    pendingPayments: invoke('reports:pendingPayments'),
    exportPDF: invoke('reports:exportPDF')
  },
  payouts: { list: invoke('payouts:list'), add: invoke('payouts:add') },
  settings: { organization: invoke('settings:organization'), saveOrganization: invoke('settings:saveOrganization') },
  backup: { create: invoke('backup:create'), restore: invoke('backup:restore') }
}));
