require("dotenv").config();

const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const PERSONA_PROFILES = {
  "meeting-heavy": {
    id: "meeting-heavy",
    label: "Meeting-heavy",
    loadTarget: 0.75,
    loadTolerance: 0.35,
    adjacencyPenaltyWeight: 0.12,
    densityPenaltyWeight: 0.12,
    preferenceRelief: 0.45,
    typeWeights: {
      investors: 1.0,
      customers: 0.9,
      candidates: 0.8,
      other: 0.6,
    },
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    loadTarget: 0.5,
    loadTolerance: 0.3,
    adjacencyPenaltyWeight: 0.18,
    densityPenaltyWeight: 0.2,
    preferenceRelief: 0.25,
    typeWeights: {
      investors: 0.85,
      customers: 0.95,
      candidates: 0.9,
      other: 0.6,
    },
  },
  maker: {
    id: "maker",
    label: "Maker / Focus",
    loadTarget: 0.25,
    loadTolerance: 0.25,
    adjacencyPenaltyWeight: 0.24,
    densityPenaltyWeight: 0.3,
    preferenceRelief: 0.1,
    typeWeights: {
      investors: 0.75,
      customers: 0.8,
      candidates: 0.7,
      other: 0.45,
    },
  },
};

const DEFAULT_PERSONA = "balanced";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function minutesBetween(start, end) {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function addOneDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const zonePart = parts.find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  const match = zonePart.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);

  return sign * ((hours * 60 + minutes) * 60000);
}

function getDateTimePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  return {
    year: parts.find((part) => part.type === "year")?.value,
    month: parts.find((part) => part.type === "month")?.value,
    day: parts.find((part) => part.type === "day")?.value,
    hour: parts.find((part) => part.type === "hour")?.value,
    minute: parts.find((part) => part.type === "minute")?.value,
    second: parts.find((part) => part.type === "second")?.value,
  };
}

function formatIsoInTimeZone(date, timeZone) {
  const { year, month, day, hour, minute, second } = getDateTimePartsInTimeZone(date, timeZone);
  const offsetMs = getTimeZoneOffsetMs(date, timeZone);

  const sign = offsetMs >= 0 ? "+" : "-";
  const absMinutes = Math.floor(Math.abs(offsetMs) / 60000);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetMinutes = String(absMinutes % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHours}:${offsetMinutes}`;
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const localWallClockMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Iterative conversion ensures the correct offset is applied even around DST shifts.
  let utcMs = localWallClockMs;
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const candidateUtcMs = localWallClockMs - offsetMs;

    if (candidateUtcMs === utcMs) {
      break;
    }

    utcMs = candidateUtcMs;
  }

  return new Date(utcMs);
}

function parseDateString(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function getWorkdayBounds(timeZone, dateString) {
  const explicitDate = parseDateString(dateString);
  const now = new Date();
  const { year, month, day } = explicitDate || getDatePartsInTimeZone(now, timeZone);
  const nextDay = addOneDay(year, month, day);

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    date,
    dayStart: zonedTimeToUtc(year, month, day, 0, 0, timeZone),
    dayEnd: zonedTimeToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, timeZone),
    workStart: zonedTimeToUtc(year, month, day, 9, 0, timeZone),
    workEnd: zonedTimeToUtc(year, month, day, 17, 0, timeZone),
  };
}

function parseCalendarTime(value, timeZone) {
  if (!value) {
    return null;
  }

  if (value.dateTime) {
    return new Date(value.dateTime);
  }

  if (value.date) {
    const [year, month, day] = value.date.split("-").map(Number);
    return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
  }

  return null;
}

function normalizeMeetingType(rawType) {
  const value = String(rawType || "other").toLowerCase().trim();
  if (["investors", "candidates", "customers", "other"].includes(value)) {
    return value;
  }

  if (value === "investor") {
    return "investors";
  }

  if (value === "candidate") {
    return "candidates";
  }

  if (value === "customer") {
    return "customers";
  }

  if (value === "internal") {
    return "other";
  }

  return "other";
}

function getMeetingTypeFromEvent(event) {
  return normalizeMeetingType(
    event?.extendedProperties?.private?.meetingType || event?.meetingType || event?.type || "other",
  );
}

function getPersonaProfile(personaId) {
  return PERSONA_PROFILES[personaId] || PERSONA_PROFILES[DEFAULT_PERSONA];
}

function isAdvancedResponseEnabled(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return false;
}

function getMeetingTypeWeight(persona, meetingType) {
  return persona.typeWeights[meetingType] || persona.typeWeights.other || 0.5;
}

function createEmptyMeetingTypeMinutes() {
  return {
    investors: 0,
    candidates: 0,
    customers: 0,
    other: 0,
  };
}

function inferMeetingTypePreferences(meetingTypeMinutes, persona) {
  const ordered = Object.entries(meetingTypeMinutes)
    .map(([meetingType, minutes]) => ({
      meetingType,
      minutes,
      weight: persona.typeWeights[meetingType] || persona.typeWeights.other,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = ordered.reduce((sum, item) => sum + item.minutes, 0);
  const weightedMinutes = ordered.reduce((sum, item) => sum + item.minutes * item.weight, 0);

  const inferredPreferredMeetingTypes = ordered
    .filter((item) => item.minutes > 0)
    .slice(0, 2)
    .map((item) => item.meetingType);

  const topMinutes = ordered[0]?.minutes || 0;
  const concentration = totalMinutes > 0 ? clamp(topMinutes / totalMinutes) : 0;

  const meetingTypeAffinityScore = totalMinutes > 0 ? clamp(weightedMinutes / totalMinutes) : clamp(persona.typeWeights.other);
  const preferenceConfidenceScore = totalMinutes > 0 ? Number(concentration.toFixed(3)) : 0;

  return {
    inferredPreferredMeetingTypes,
    meetingTypeAffinityScore: Number(meetingTypeAffinityScore.toFixed(3)),
    preferenceConfidenceScore,
  };
}

function mergeIntervals(intervals) {
  if (!intervals.length) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (const interval of sorted.slice(1)) {
    const current = merged[merged.length - 1];

    if (interval.start <= current.end) {
      current.end = new Date(Math.max(current.end.getTime(), interval.end.getTime()));
    } else {
      merged.push(interval);
    }
  }

  return merged;
}

function invertIntervals(busyIntervals, rangeStart, rangeEnd) {
  const available = [];
  let cursor = rangeStart;

  for (const busy of busyIntervals) {
    if (busy.start > cursor) {
      available.push({ start: new Date(cursor), end: new Date(busy.start) });
    }

    if (busy.end > cursor) {
      cursor = busy.end;
    }
  }

  if (cursor < rangeEnd) {
    available.push({ start: new Date(cursor), end: new Date(rangeEnd) });
  }

  return available;
}

function scoreAvailableSlot(
  slot,
  mergedBusy,
  clippedBusyByType,
  dailyLoadScore,
  totalMeetings,
  workdayMinutes,
  timeZone,
  persona,
  meetingPreferenceScore,
  personaMeetingAversion,
) {
  const durationMinutes = Math.round(minutesBetween(slot.start, slot.end));

  // Base utility favors uninterrupted focus blocks.
  // 90 minutes is treated as "ideal" for this demo so that
  // 30-minute buffers still retain some usable bandwidth.
  const uninterruptedScore = clamp(durationMinutes / 90);

  // Penalty for adjacency pressure:
  // if a meeting is within 15 minutes before or after this slot,
  // reduce score because context switching risk is higher.
  let before = null;
  let after = null;

  for (const busy of mergedBusy) {
    if (busy.end <= slot.start) {
      before = busy;
      continue;
    }

    if (busy.start >= slot.end) {
      after = busy;
      break;
    }
  }

  let adjacencyPenalty = 0;

  if (before) {
    const gapBefore = minutesBetween(before.end, slot.start);
    if (gapBefore < 15) {
      adjacencyPenalty += ((15 - gapBefore) / 15) * persona.adjacencyPenaltyWeight * 0.45;
    }
  }

  if (after) {
    const gapAfter = minutesBetween(slot.end, after.start);
    if (gapAfter < 15) {
      adjacencyPenalty += ((15 - gapAfter) / 15) * persona.adjacencyPenaltyWeight * 0.45;
    }
  }

  // Additional type-aware pressure penalty:
  // meeting-averse personas lose more bandwidth when nearby meetings are from disfavored types.
  let beforeTyped = null;
  let afterTyped = null;
  for (const busy of clippedBusyByType) {
    if (busy.end <= slot.start) {
      beforeTyped = busy;
      continue;
    }

    if (busy.start >= slot.end) {
      afterTyped = busy;
      break;
    }
  }

  let dislikedTypePenalty = 0;

  if (beforeTyped) {
    const gapBefore = minutesBetween(beforeTyped.end, slot.start);
    const proximity = clamp((45 - gapBefore) / 45);
    const dislike = clamp(1 - beforeTyped.meetingTypeWeight);
    dislikedTypePenalty += proximity * dislike * 0.12 * personaMeetingAversion;
  }

  if (afterTyped) {
    const gapAfter = minutesBetween(slot.end, afterTyped.start);
    const proximity = clamp((45 - gapAfter) / 45);
    const dislike = clamp(1 - afterTyped.meetingTypeWeight);
    dislikedTypePenalty += proximity * dislike * 0.12 * personaMeetingAversion;
  }

  // Density penalty combines:
  // 1) daily load (% of workday booked), and
  // 2) meeting count per workday hour.
  // Persona affects how costly density is:
  // - meeting-heavy personas tolerate density more,
  // - maker personas penalize it heavily.
  // Meeting preference score can partially offset density when meetings are aligned with goals.
  const workdayHours = workdayMinutes / 60;
  const meetingsPerHour = workdayHours > 0 ? totalMeetings / workdayHours : 0;
  const rawDensityPenalty = clamp(
    (dailyLoadScore * persona.densityPenaltyWeight + Math.min(0.3, meetingsPerHour * 0.06)) * 0.75,
    0,
    0.45,
  );
  const densityPenalty = clamp(rawDensityPenalty * (1 - meetingPreferenceScore * persona.preferenceRelief), 0, 0.45);

  // Explicit aversion penalties:
  // 1) high meeting load hurts meeting-averse personas more,
  // 2) dispreferred meeting mix hurts even more.
  const aversionLoadPenalty = dailyLoadScore * personaMeetingAversion * 0.1;
  const aversionTypePenalty = (1 - meetingPreferenceScore) * personaMeetingAversion * 0.12;

  const rawBandwidthScore =
    uninterruptedScore -
    adjacencyPenalty -
    densityPenalty -
    aversionLoadPenalty -
    aversionTypePenalty -
    dislikedTypePenalty;

  let bandwidthScore = clamp(rawBandwidthScore);

  // Keep short buffers usable in demos:
  // 30-59 minute windows should usually be low bandwidth, but not hard-zero,
  // unless upstream logic makes them truly invalid.
  let minimumShortSlotScore = 0;
  if (durationMinutes >= 30 && durationMinutes < 60) {
    minimumShortSlotScore = clamp(
      0.08 + meetingPreferenceScore * 0.08 - personaMeetingAversion * 0.04,
      0.06,
      0.16,
    );
    bandwidthScore = Math.max(bandwidthScore, minimumShortSlotScore);
  }

  let bandwidthLevel = "low";
  if (bandwidthScore >= 0.7) {
    bandwidthLevel = "high";
  } else if (bandwidthScore >= 0.4) {
    bandwidthLevel = "medium";
  }

  return {
    start: formatIsoInTimeZone(slot.start, timeZone),
    end: formatIsoInTimeZone(slot.end, timeZone),
    durationMinutes,
    bandwidthScore: Number(bandwidthScore.toFixed(3)),
    bandwidthLevel,
    penaltyBreakdown: {
      uninterruptedScore: Number(uninterruptedScore.toFixed(3)),
      adjacencyPenalty: Number(adjacencyPenalty.toFixed(3)),
      densityPenalty: Number(densityPenalty.toFixed(3)),
      aversionLoadPenalty: Number(aversionLoadPenalty.toFixed(3)),
      aversionTypePenalty: Number(aversionTypePenalty.toFixed(3)),
      dislikedTypePenalty: Number(dislikedTypePenalty.toFixed(3)),
      rawBandwidthScore: Number(rawBandwidthScore.toFixed(3)),
      minimumShortSlotScore: Number(minimumShortSlotScore.toFixed(3)),
      finalBandwidthScore: Number(bandwidthScore.toFixed(3)),
    },
  };
}

function analyzeDayFromEvents(events, timeZone, dateString, persona) {
  const { date, workStart, workEnd } = getWorkdayBounds(timeZone, dateString);
  const personaMeetingAversion = clamp(1 - persona.loadTarget);

  const clippedBusy = [];
  const meetingTypeMinutes = createEmptyMeetingTypeMinutes();
  let workdayMeetingCount = 0;
  for (const event of events) {
    if (event.status === "cancelled") {
      continue;
    }

    const start = parseCalendarTime(event.start, timeZone);
    const end = parseCalendarTime(event.end, timeZone);

    if (!start || !end || end <= start) {
      continue;
    }

    const clippedStart = new Date(Math.max(start.getTime(), workStart.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), workEnd.getTime()));

    if (clippedEnd > clippedStart) {
      const meetingType = getMeetingTypeFromEvent(event);
      const clippedMinutes = minutesBetween(clippedStart, clippedEnd);

      workdayMeetingCount += 1;
      meetingTypeMinutes[meetingType] += clippedMinutes;
      clippedBusy.push({
        start: clippedStart,
        end: clippedEnd,
        meetingType,
        meetingTypeWeight: getMeetingTypeWeight(persona, meetingType),
      });
    }
  }

  const mergedBusy = mergeIntervals(clippedBusy.map((block) => ({ start: block.start, end: block.end })));
  const clippedBusyByType = [...clippedBusy].sort((a, b) => a.start - b.start);
  const availableSlotsRaw = invertIntervals(mergedBusy, workStart, workEnd);

  const totalBusyMinutes = Math.round(
    mergedBusy.reduce((sum, block) => sum + minutesBetween(block.start, block.end), 0),
  );

  const workdayMinutes = Math.round(minutesBetween(workStart, workEnd));
  const dailyLoadScore = workdayMinutes > 0 ? clamp(totalBusyMinutes / workdayMinutes) : 0;

  const totalTypedMeetingMinutes = Object.values(meetingTypeMinutes).reduce((sum, minutes) => sum + minutes, 0);
  const weightedMeetingSum = Object.entries(meetingTypeMinutes).reduce((sum, [meetingType, minutes]) => {
    const weight = persona.typeWeights[meetingType] || persona.typeWeights.other;
    return sum + minutes * weight;
  }, 0);

  const meetingPreferenceScore =
    totalTypedMeetingMinutes > 0
      ? clamp(weightedMeetingSum / totalTypedMeetingMinutes)
      : clamp(persona.typeWeights.other);

  const inferredPreferences = inferMeetingTypePreferences(meetingTypeMinutes, persona);

  const loadFitScore = clamp(1 - Math.abs(dailyLoadScore - persona.loadTarget) / persona.loadTolerance);
  const personaFitScore = clamp(meetingPreferenceScore * 0.6 + loadFitScore * 0.4);

  const availableSlots = availableSlotsRaw
    .filter((slot) => slot.end > slot.start)
    .map((slot) =>
      scoreAvailableSlot(
        slot,
        mergedBusy,
        clippedBusyByType,
        dailyLoadScore,
        workdayMeetingCount,
        workdayMinutes,
        timeZone,
        persona,
        meetingPreferenceScore,
        personaMeetingAversion,
      ),
    );

  return {
    date,
    availableSlots,
    dailyLoadScore: Number(dailyLoadScore.toFixed(3)),
    meetingPreferenceScore: Number(meetingPreferenceScore.toFixed(3)),
    meetingTypeAffinityScore: inferredPreferences.meetingTypeAffinityScore,
    inferredPreferredMeetingTypes: inferredPreferences.inferredPreferredMeetingTypes,
    preferenceConfidenceScore: inferredPreferences.preferenceConfidenceScore,
    meetingAversionScore: Number(personaMeetingAversion.toFixed(3)),
    loadFitScore: Number(loadFitScore.toFixed(3)),
    personaFitScore: Number(personaFitScore.toFixed(3)),
    meetingTypeMinutes,
    totalMeetings: workdayMeetingCount,
    totalBusyMinutes,
  };
}

function formatSlotForResponse(slot, advancedResponse) {
  const base = {
    start: slot.start,
    end: slot.end,
    durationMinutes: slot.durationMinutes,
    bandwidthScore: slot.bandwidthScore,
    bandwidthLevel: slot.bandwidthLevel,
  };

  if (advancedResponse) {
    return {
      ...base,
      penaltyBreakdown: slot.penaltyBreakdown,
    };
  }

  return base;
}

function formatDayAnalysisForResponse(dayAnalysis, advancedResponse) {
  const base = {
    date: dayAnalysis.date,
    availableSlots: dayAnalysis.availableSlots.map((slot) => formatSlotForResponse(slot, advancedResponse)),
    dailyLoadScore: dayAnalysis.dailyLoadScore,
    personaFitScore: dayAnalysis.personaFitScore,
    inferredPreferredMeetingTypes: dayAnalysis.inferredPreferredMeetingTypes,
  };

  if (advancedResponse) {
    return {
      ...base,
      meetingPreferenceScore: dayAnalysis.meetingPreferenceScore,
      meetingTypeAffinityScore: dayAnalysis.meetingTypeAffinityScore,
      preferenceConfidenceScore: dayAnalysis.preferenceConfidenceScore,
      meetingAversionScore: dayAnalysis.meetingAversionScore,
      loadFitScore: dayAnalysis.loadFitScore,
      meetingTypeMinutes: dayAnalysis.meetingTypeMinutes,
      totalMeetings: dayAnalysis.totalMeetings,
      totalBusyMinutes: dayAnalysis.totalBusyMinutes,
    };
  }

  return base;
}


app.post("/analyze-manual", (req, res) => {
  try {
    const timeZone = req.body.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = req.body.date;
    const persona = getPersonaProfile(req.body.persona);
    const advancedResponse = isAdvancedResponseEnabled(req.body.advancedResponse ?? req.query.advancedResponse);
    const events = Array.isArray(req.body.events) ? req.body.events : [];

    if (date && !parseDateString(date)) {
      return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD." });
    }

    const analysis = analyzeDayFromEvents(events, timeZone, date, persona);
    res.json({
      timeZone,
      persona: persona.id,
      personaLabel: persona.label,
      advancedResponse,
      ...formatDayAnalysisForResponse(analysis, advancedResponse),
    });
  } catch (error) {
    console.error("Manual analyze endpoint error:", error);
    res.status(500).json({ error: "Failed to analyze manual calendar.", details: error.message });
  }
});

app.post("/analyze-manual-multiday", (req, res) => {
  try {
    const timeZone = req.body.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const persona = getPersonaProfile(req.body.persona);
    const advancedResponse = isAdvancedResponseEnabled(req.body.advancedResponse ?? req.query.advancedResponse);
    const schedules = Array.isArray(req.body.schedules) ? req.body.schedules : [];

    if (!schedules.length) {
      return res.status(400).json({ error: "schedules must be a non-empty array." });
    }

    const days = [];
    for (const schedule of schedules) {
      if (!schedule || !parseDateString(schedule.date)) {
        return res.status(400).json({ error: "Each schedule.date must be YYYY-MM-DD." });
      }

      const events = Array.isArray(schedule.events) ? schedule.events : [];
      days.push(analyzeDayFromEvents(events, timeZone, schedule.date, persona));
    }

    const averageDailyLoadScore =
      days.length > 0
        ? Number((days.reduce((sum, day) => sum + day.dailyLoadScore, 0) / days.length).toFixed(3))
        : 0;

    const averagePersonaFitScore =
      days.length > 0
        ? Number((days.reduce((sum, day) => sum + day.personaFitScore, 0) / days.length).toFixed(3))
        : 0;

    const aggregateMeetingTypeMinutes = createEmptyMeetingTypeMinutes();
    for (const day of days) {
      for (const [meetingType, minutes] of Object.entries(day.meetingTypeMinutes || {})) {
        aggregateMeetingTypeMinutes[meetingType] += Number(minutes || 0);
      }
    }

    const aggregatePreference = inferMeetingTypePreferences(aggregateMeetingTypeMinutes, persona);

    const baseResponse = {
      timeZone,
      persona: persona.id,
      personaLabel: persona.label,
      advancedResponse,
      days: days.map((day) => formatDayAnalysisForResponse(day, advancedResponse)),
      averageDailyLoadScore,
      averagePersonaFitScore,
      inferredPreferredMeetingTypes: aggregatePreference.inferredPreferredMeetingTypes,
    };

    if (advancedResponse) {
      return res.json({
        ...baseResponse,
        aggregateMeetingTypeMinutes,
        meetingTypeAffinityScore: aggregatePreference.meetingTypeAffinityScore,
        preferenceConfidenceScore: aggregatePreference.preferenceConfidenceScore,
      });
    }

    return res.json(baseResponse);
  } catch (error) {
    console.error("Manual multiday analyze endpoint error:", error);
    res.status(500).json({ error: "Failed to analyze multi-day manual calendar.", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Calendar bandwidth demo running on http://localhost:${PORT}`);
});
