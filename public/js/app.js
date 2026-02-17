import { addDays, toDateInputValue } from "./date-utils.js";
import { ScheduleModel } from "./schedule-model.js";
import { GridController } from "./grid-controller.js";
import { analyzeManualMultiDay } from "./api-client.js";
import { updateManualMeta, updateMeetingTypePickerStyling } from "./ui-helpers.js";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const analyzeManualBtn = document.getElementById("analyzeManualBtn");
const clearSlotsBtn = document.getElementById("clearSlotsBtn");
const personaTypeInput = document.getElementById("personaType");
const meetingTypeInput = document.getElementById("meetingType");
const advancedResponseInput = document.getElementById("advancedResponse");
const startDateInput = document.getElementById("startDate");
const dayCountInput = document.getElementById("dayCount");
const slotGrid = document.getElementById("slotGrid");
const manualMeta = document.getElementById("manualMeta");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

const model = new ScheduleModel();
const grid = new GridController({
  slotGrid,
  meetingTypeInput,
  model,
  onSelectionChanged: () => updateManualMeta(manualMeta, model),
});

function renderAndRefreshMeta() {
  grid.render();
  updateManualMeta(manualMeta, model);
}

function rebuildDateColumns() {
  const startDate = startDateInput.value;
  const dayCount = Number(dayCountInput.value);

  if (!startDate || !Number.isInteger(dayCount) || dayCount < 1) {
    model.setSelectedDates([]);
    renderAndRefreshMeta();
    return;
  }

  const selectedDates = Array.from({ length: dayCount }, (_, index) => addDays(startDate, index));
  model.setSelectedDates(selectedDates);
  renderAndRefreshMeta();
}

async function runManualAnalysis() {
  const selectedDates = model.getSelectedDates();
  if (!selectedDates.length) {
    statusEl.textContent = "Choose a start date and day count first.";
    return;
  }

  const schedules = model.buildMultiDaySchedules();
  statusEl.textContent = "Analyzing multi-day manual schedule...";

  try {
    const result = await analyzeManualMultiDay({
      timeZone,
      persona: personaTypeInput.value,
      advancedResponse: advancedResponseInput.checked,
      schedules,
    });

    if (!result.ok) {
      statusEl.textContent = result.data.error || "Manual analysis failed.";
      outputEl.textContent = JSON.stringify(result.data, null, 2);
      return;
    }

    statusEl.textContent = "Multi-day manual analysis ready.";
    outputEl.textContent = JSON.stringify(result.data, null, 2);
  } catch (error) {
    statusEl.textContent = "Manual analysis failed.";
    outputEl.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
}

analyzeManualBtn.addEventListener("click", runManualAnalysis);
startDateInput.addEventListener("change", rebuildDateColumns);
dayCountInput.addEventListener("change", rebuildDateColumns);
meetingTypeInput.addEventListener("change", () => updateMeetingTypePickerStyling(meetingTypeInput));

clearSlotsBtn.addEventListener("click", () => {
  model.clearAllSlots();
  renderAndRefreshMeta();
});

document.addEventListener("mouseup", () => {
  grid.resetDrag();
});

document.addEventListener("mouseleave", () => {
  grid.resetDrag();
});

startDateInput.value = toDateInputValue(new Date());
updateMeetingTypePickerStyling(meetingTypeInput);
rebuildDateColumns();
