import { slotToDate } from "./date-utils.js";

export class ScheduleModel {
  constructor() {
    this.busyByDate = new Map();
    this.selectedDates = [];
  }

  getSelectedDates() {
    return [...this.selectedDates];
  }

  setSelectedDates(dates) {
    this.selectedDates = [...dates];

    const keepDates = new Set(this.selectedDates);
    for (const key of this.busyByDate.keys()) {
      if (!keepDates.has(key)) {
        this.busyByDate.delete(key);
      }
    }

    for (const dateString of this.selectedDates) {
      this.getDateSlots(dateString);
    }
  }

  getDateSlots(dateString) {
    if (!this.busyByDate.has(dateString)) {
      this.busyByDate.set(dateString, new Map());
    }

    return this.busyByDate.get(dateString);
  }

  getDateIndex(dateString) {
    return this.selectedDates.indexOf(dateString);
  }

  cloneBusyState() {
    const snapshot = new Map();
    for (const dateString of this.selectedDates) {
      snapshot.set(dateString, new Map(this.getDateSlots(dateString)));
    }
    return snapshot;
  }

  restoreBusyState(snapshot) {
    for (const dateString of this.selectedDates) {
      const target = this.getDateSlots(dateString);
      target.clear();
      const source = snapshot.get(dateString) || new Map();
      for (const [slotIndex, meetingType] of source.entries()) {
        target.set(slotIndex, meetingType);
      }
    }
  }

  setSlotBusy(dateString, slotIndex, shouldBeBusy, meetingType = "other") {
    const dateSlots = this.getDateSlots(dateString);

    if (shouldBeBusy) {
      dateSlots.set(slotIndex, meetingType);
      return;
    }

    dateSlots.delete(slotIndex);
  }

  clearAllSlots() {
    for (const dateString of this.selectedDates) {
      this.getDateSlots(dateString).clear();
    }
  }

  getMergedBusyRanges(dateString) {
    const entries = [...this.getDateSlots(dateString).entries()].sort((a, b) => a[0] - b[0]);
    if (!entries.length) {
      return [];
    }

    const ranges = [];
    let rangeStart = entries[0][0];
    let prev = entries[0][0];
    let rangeType = entries[0][1];

    for (const [index, meetingType] of entries.slice(1)) {
      if (index === prev + 1 && meetingType === rangeType) {
        prev = index;
        continue;
      }

      ranges.push({ startSlot: rangeStart, endSlotExclusive: prev + 1, meetingType: rangeType });
      rangeStart = index;
      prev = index;
      rangeType = meetingType;
    }

    ranges.push({ startSlot: rangeStart, endSlotExclusive: prev + 1, meetingType: rangeType });
    return ranges;
  }

  buildScheduleForDate(dateString) {
    const ranges = this.getMergedBusyRanges(dateString);

    const events = ranges.map((range) => {
      const start = slotToDate(dateString, range.startSlot);
      const end = slotToDate(dateString, range.endSlotExclusive);

      return {
        status: "confirmed",
        meetingType: range.meetingType,
        extendedProperties: { private: { meetingType: range.meetingType } },
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      };
    });

    return {
      date: dateString,
      events,
    };
  }

  buildMultiDaySchedules() {
    return this.selectedDates.map((dateString) => this.buildScheduleForDate(dateString));
  }

  getTotalBlocks() {
    return this.selectedDates.reduce((sum, dateString) => sum + this.getMergedBusyRanges(dateString).length, 0);
  }
}
