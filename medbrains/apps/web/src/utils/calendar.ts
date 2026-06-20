/**
 * Universal calendar helpers — no OAuth. An `.ics` (RFC 5545) opens in Google
 * Calendar, Outlook, and Apple Calendar; the Google template URL adds the event
 * to Google Calendar in one click. Used to put a tele-consultation on a
 * doctor's/patient's calendar regardless of provider.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  /** Join link, embedded in the event location + body. */
  url: string;
  /** Start time; defaults to now if absent. */
  start: Date;
  /** Duration in minutes (default 30). */
  durationMinutes?: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format a Date as a UTC iCal timestamp: YYYYMMDDTHHMMSSZ. */
function toICalUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Escape per RFC 5545 (commas, semicolons, newlines). */
function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (m) => `\\${m}`)
    .replace(/\n/g, "\\n");
}

function endTime(event: CalendarEvent): Date {
  return new Date(event.start.getTime() + (event.durationMinutes ?? 30) * 60_000);
}

/** Build the .ics file body for a single event. */
export function buildIcs(event: CalendarEvent): string {
  const uid = `${toICalUtc(event.start)}-${Math.abs(hashString(event.url))}@medbrains`;
  const body = `${event.description}\n\nJoin: ${event.url}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedBrains//Telemedicine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICalUtc(new Date(event.start.getTime()))}`,
    `DTSTART:${toICalUtc(event.start)}`,
    `DTEND:${toICalUtc(endTime(event))}`,
    `SUMMARY:${escapeIcal(event.title)}`,
    `DESCRIPTION:${escapeIcal(body)}`,
    `LOCATION:${escapeIcal(event.url)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** Trigger a browser download of the event as an .ics file. */
export function downloadIcs(event: CalendarEvent, filename = "consultation.ics"): void {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/** One-click "Add to Google Calendar" template URL (no OAuth). */
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = `${toICalUtc(event.start)}/${toICalUtc(endTime(event))}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: `${event.description}\n\nJoin: ${event.url}`,
    location: event.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
