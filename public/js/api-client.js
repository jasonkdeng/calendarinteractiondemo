export async function analyzeManualMultiDay(payload) {
  const response = await fetch("/analyze-manual-multiday", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
