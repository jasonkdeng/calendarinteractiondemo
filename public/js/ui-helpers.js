import { getMeetingTypeColor } from "./constants.js";

export function updateMeetingTypePickerStyling(meetingTypeInput) {
  const meetingType = meetingTypeInput.value;
  const color = getMeetingTypeColor(meetingType);
  meetingTypeInput.style.borderColor = color;
  meetingTypeInput.style.boxShadow = `inset 0 0 0 9999px color-mix(in srgb, ${color} 14%, white)`;
}

export function updateManualMeta(manualMetaEl, model) {
  const selectedDates = model.getSelectedDates();
  const totalBlocks = model.getTotalBlocks();
  manualMetaEl.textContent = `Days selected: ${selectedDates.length} | Busy blocks selected: ${totalBlocks}`;
}
