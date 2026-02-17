import { SLOT_COUNT, MEETING_TYPE_CLASS_MAP, getMeetingTypeClass } from "./constants.js";
import { formatDateShort, formatSlotLabel } from "./date-utils.js";

export class GridController {
  constructor({ slotGrid, meetingTypeInput, model, onSelectionChanged }) {
    this.slotGrid = slotGrid;
    this.meetingTypeInput = meetingTypeInput;
    this.model = model;
    this.onSelectionChanged = onSelectionChanged;

    this.isMouseDragging = false;
    this.dragPaintBusy = null;
    this.dragMeetingType = null;
    this.dragStartCell = null;
    this.dragBaseByDate = null;
  }

  resetDrag() {
    this.isMouseDragging = false;
    this.dragPaintBusy = null;
    this.dragMeetingType = null;
    this.dragStartCell = null;
    this.dragBaseByDate = null;
  }

  syncGridFromModel() {
    for (const cell of this.slotGrid.querySelectorAll(".slot-cell")) {
      const slotIndex = Number(cell.dataset.slotIndex);
      const dateString = cell.dataset.date;
      const dateSlots = this.model.getDateSlots(dateString);
      const isBusy = dateSlots.has(slotIndex);
      const meetingType = isBusy ? dateSlots.get(slotIndex) : "free";

      for (const className of Object.values(MEETING_TYPE_CLASS_MAP)) {
        cell.classList.remove(className);
      }

      cell.classList.toggle("busy", isBusy);
      if (isBusy) {
        cell.classList.add(getMeetingTypeClass(meetingType));
      }
      cell.title = `${dateString} ${formatSlotLabel(slotIndex)} ${meetingType}`;
    }
  }

  applyDragRectangle(currentDateString, currentSlotIndex) {
    if (!this.dragStartCell || !this.dragBaseByDate || this.dragPaintBusy === null) {
      return;
    }

    const currentDateIndex = this.model.getDateIndex(currentDateString);
    if (currentDateIndex < 0) {
      return;
    }

    const minDay = Math.min(this.dragStartCell.dateIndex, currentDateIndex);
    const maxDay = Math.max(this.dragStartCell.dateIndex, currentDateIndex);
    const minSlot = Math.min(this.dragStartCell.slotIndex, currentSlotIndex);
    const maxSlot = Math.max(this.dragStartCell.slotIndex, currentSlotIndex);

    this.model.restoreBusyState(this.dragBaseByDate);

    for (let dayIndex = minDay; dayIndex <= maxDay; dayIndex += 1) {
      const dateString = this.model.getSelectedDates()[dayIndex];
      if (!dateString) {
        continue;
      }

      for (let slotIndex = minSlot; slotIndex <= maxSlot; slotIndex += 1) {
        this.model.setSlotBusy(dateString, slotIndex, this.dragPaintBusy, this.dragMeetingType);
      }
    }

    this.syncGridFromModel();
    this.onSelectionChanged();
  }

  render() {
    const selectedDates = this.model.getSelectedDates();

    this.slotGrid.style.setProperty("--day-count", String(selectedDates.length || 1));
    this.slotGrid.innerHTML = "";

    const timeHeader = document.createElement("div");
    timeHeader.className = "slot-head";
    timeHeader.textContent = "Time";
    this.slotGrid.appendChild(timeHeader);

    for (const dateString of selectedDates) {
      const dateHead = document.createElement("div");
      dateHead.className = "slot-head";
      dateHead.textContent = formatDateShort(dateString);
      this.slotGrid.appendChild(dateHead);
    }

    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
      const label = document.createElement("div");
      label.className = "slot-time";
      label.textContent = formatSlotLabel(slotIndex);
      this.slotGrid.appendChild(label);

      for (const dateString of selectedDates) {
        const dateSlots = this.model.getDateSlots(dateString);
        const isBusy = dateSlots.has(slotIndex);
        const meetingType = isBusy ? dateSlots.get(slotIndex) : "free";

        const cell = document.createElement("div");
        cell.className = `slot-cell${isBusy ? ` busy ${getMeetingTypeClass(meetingType)}` : ""}`;
        cell.dataset.slotIndex = String(slotIndex);
        cell.dataset.date = dateString;
        cell.dataset.dayIndex = String(this.model.getDateIndex(dateString));
        cell.title = `${dateString} ${formatSlotLabel(slotIndex)} ${meetingType}`;

        cell.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }

          event.preventDefault();
          this.isMouseDragging = true;

          const startedOnSelectedCell = cell.classList.contains("busy");
          this.dragPaintBusy = !startedOnSelectedCell;
          this.dragMeetingType = this.meetingTypeInput.value;
          this.dragStartCell = {
            dateIndex: this.model.getDateIndex(dateString),
            slotIndex,
          };
          this.dragBaseByDate = this.model.cloneBusyState();
          this.applyDragRectangle(dateString, slotIndex);
        });

        cell.addEventListener("mouseenter", () => {
          if (!this.isMouseDragging || this.dragPaintBusy === null) {
            return;
          }

          this.applyDragRectangle(dateString, slotIndex);
        });

        this.slotGrid.appendChild(cell);
      }
    }
  }
}
