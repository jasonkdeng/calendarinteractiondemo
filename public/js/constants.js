export const SLOT_MINUTES = 30;
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 17;
export const SLOT_COUNT = ((WORK_END_HOUR - WORK_START_HOUR) * 60) / SLOT_MINUTES;

export const MEETING_TYPE_CLASS_MAP = {
  investors: "type-investors",
  candidates: "type-candidates",
  customers: "type-customers",
  other: "type-other",
};

export const MEETING_TYPE_COLOR_MAP = {
  investors: "var(--type-investors)",
  candidates: "var(--type-candidates)",
  customers: "var(--type-customers)",
  other: "var(--type-other)",
};

export function getMeetingTypeClass(meetingType) {
  return MEETING_TYPE_CLASS_MAP[meetingType] || MEETING_TYPE_CLASS_MAP.other;
}

export function getMeetingTypeColor(meetingType) {
  return MEETING_TYPE_COLOR_MAP[meetingType] || MEETING_TYPE_COLOR_MAP.other;
}
