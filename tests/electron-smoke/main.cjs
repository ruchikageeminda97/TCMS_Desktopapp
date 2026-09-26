const { app } = require('electron');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  try {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE smoke_test (value TEXT NOT NULL)');
    db.prepare('INSERT INTO smoke_test (value) VALUES (?)').run('sqlite is available in Electron');
    const result = db.prepare('SELECT value FROM smoke_test').get();
    db.close();
    if (result.value !== 'sqlite is available in Electron') throw new Error('SQLite smoke-test result was incorrect.');
    console.log('Electron can load better-sqlite3 and execute SQLite queries.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
