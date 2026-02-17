import { NextResponse } from "next/server";
import {
  analyzeDayFromEvents,
  formatDayAnalysisForResponse,
  getPersonaProfile,
  isAdvancedResponseEnabled,
  parseDateString,
} from "../_lib/bandwidth.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const timeZone = body.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = body.date;
    const persona = getPersonaProfile(body.persona);
    const advancedResponse = isAdvancedResponseEnabled(body.advancedResponse);
    const events = Array.isArray(body.events) ? body.events : [];

    if (date && !parseDateString(date)) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }

    const analysis = analyzeDayFromEvents(events, timeZone, date, persona);

    return NextResponse.json({
      timeZone,
      persona: persona.id,
      personaLabel: persona.label,
      advancedResponse,
      ...formatDayAnalysisForResponse(analysis, advancedResponse),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to analyze manual calendar.", details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
