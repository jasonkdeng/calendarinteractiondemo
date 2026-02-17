import { SLOT_MINUTES, WORK_START_HOUR } from "./constants.js";

export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatSlotLabel(slotIndex) {
  const totalMinutes = WORK_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hour24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addDays(dateString, daysToAdd) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  return toDateInputValue(date);
}

export function formatDateShort(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function slotToDate(dateString, slotIndex) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day, WORK_START_HOUR, 0, 0, 0);
  date.setMinutes(date.getMinutes() + slotIndex * SLOT_MINUTES);
  return date;
}
