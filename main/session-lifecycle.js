function completeOngoingSession(db, sessionId, automatic = false) {
  const result = db.prepare(`UPDATE sessions SET status='completed',ended_at=CURRENT_TIMESTAMP,
    ended_automatically=? WHERE session_id=? AND status='ongoing'`).run(automatic ? 1 : 0, sessionId);
  if (!result.changes) return false;
  db.prepare(`UPDATE attendance SET status='absent',marked_at=CURRENT_TIMESTAMP
    WHERE session_id=? AND status='not_marked'`).run(sessionId);
  return true;
}

function endExpiredSessions(db, date) {
  const closeExpired = db.transaction(() => {
    const sessions = db.prepare(`SELECT session_id FROM sessions
      WHERE status='ongoing' AND session_date<?`).all(date);
    sessions.forEach(({ session_id }) => completeOngoingSession(db, session_id, true));
    return sessions.length;
  });
  return closeExpired();
}

module.exports = { completeOngoingSession, endExpiredSessions };
