import type { KalenderTermin } from './kalender';
import { toIso } from './calendarDate';

export function eventsOnDay(events: KalenderTermin[], day: Date): KalenderTermin[] {
  const iso = toIso(day);
  return events.filter(e => {
    const start = e.startDatum;
    const end = e.endDatum ?? e.startDatum;
    return iso >= start && iso <= end;
  });
}

/** Ganztägig darzustellen: keine Uhrzeit, oder eine mehrtägige Datumsspanne. */
export function isAllDay(t: KalenderTermin): boolean {
  return !t.uhrzeitVon || (!!t.endDatum && t.endDatum !== t.startDatum);
}
