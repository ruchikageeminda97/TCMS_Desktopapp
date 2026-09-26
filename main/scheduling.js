const weekdays = new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']);

const validTime = time => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;

function validateSlots(slots, label) {
  if (!Array.isArray(slots)) throw new Error(`${label} must be a list of weekly time slots.`);
  for (const slot of slots) {
    if (!weekdays.has(slot.day_of_week) || !validTime(slot.start_time) || !validTime(slot.end_time) || slot.start_time >= slot.end_time) {
      throw new Error(`Check each ${label.toLowerCase()} day and time range.`);
    }
  }
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i], b = slots[j];
      if (a.day_of_week === b.day_of_week && overlaps(a.start_time, a.end_time, b.start_time, b.end_time)) {
        throw new Error(`${label} has overlapping times on ${a.day_of_week}.`);
      }
    }
  }
}

const slotIsAvailable = (slot, availability) => availability.some(open =>
  open.day_of_week === slot.day_of_week &&
  open.start_time <= slot.start_time &&
  open.end_time >= slot.end_time
);

module.exports = { overlaps, slotIsAvailable, validateSlots, validTime };
