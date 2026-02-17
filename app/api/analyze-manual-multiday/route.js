import { NextResponse } from "next/server";
import {
  analyzeDayFromEvents,
  createEmptyMeetingTypeMinutes,
  formatDayAnalysisForResponse,
  getPersonaProfile,
  inferMeetingTypePreferences,
  isAdvancedResponseEnabled,
  parseDateString,
} from "../_lib/bandwidth.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const timeZone = body.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const persona = getPersonaProfile(body.persona);
    const advancedResponse = isAdvancedResponseEnabled(body.advancedResponse);
    const schedules = Array.isArray(body.schedules) ? body.schedules : [];

    if (!schedules.length) {
      return NextResponse.json({ error: "schedules must be a non-empty array." }, { status: 400 });
    }

    const days = [];
    for (const schedule of schedules) {
      if (!schedule || !parseDateString(schedule.date)) {
        return NextResponse.json({ error: "Each schedule.date must be YYYY-MM-DD." }, { status: 400 });
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
      return NextResponse.json({
        ...baseResponse,
        aggregateMeetingTypeMinutes,
        meetingTypeAffinityScore: aggregatePreference.meetingTypeAffinityScore,
        preferenceConfidenceScore: aggregatePreference.preferenceConfidenceScore,
      });
    }

    return NextResponse.json(baseResponse);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to analyze multi-day manual calendar.", details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
