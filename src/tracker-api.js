const url = 'https://afawzutzrfqfybulmmat.supabase.co/rest/v1';
const publishableKey = 'sb_publishable_oNmB6tnxZVLCIgqyfLSKlA_7qgB0cAK';

async function request(path, { method = 'GET', body, prefer = 'return=minimal' } = {}) {
  const response = await fetch(`${url}/${path}`, {
    method,
    headers: { apikey: publishableKey, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error('Supabase request failed');
    error.status = response.status;
    throw error;
  }
  return method === 'GET' || prefer === 'return=representation' ? response.json() : undefined;
}

export async function loadWeeks() {
  const rows = await request('tracker_weeks?select=week_start,assigned_member_id,finalized_at,tracker_picks(member_id,pick_text),tracker_bozos(member_id)&order=week_start.desc');
  return Object.fromEntries(rows.map((row) => [row.week_start, {
    assigned: row.assigned_member_id,
    finalized: Boolean(row.finalized_at),
    picks: Object.fromEntries(row.tracker_picks.map((pick) => [pick.member_id, pick.pick_text])),
    bozos: row.tracker_bozos.map((bozo) => bozo.member_id),
  }]));
}

export function finalizeWeek(week) {
  return request('rpc/tracker_finalize_week', { method: 'POST', body: { target_week: week } });
}

export async function savePick(week, member, text) {
  const row = `tracker_picks?week_start=eq.${week}&member_id=eq.${member}`;
  if (!text) return request(row, { method: 'DELETE' });
  const patch = () => request(row, { method: 'PATCH', body: { pick_text: text }, prefer: 'return=representation' });
  if ((await patch()).length) return;
  try {
    await request('tracker_picks', { method: 'POST', body: { week_start: week, member_id: member, pick_text: text } });
  } catch (error) {
    if (error.status !== 409 || !(await patch()).length) throw error;
  }
}

export function setBozo(week, member, marked) {
  return marked
    ? request('tracker_bozos?on_conflict=week_start,member_id', {
        method: 'POST', prefer: 'resolution=ignore-duplicates', body: { week_start: week, member_id: member },
      })
    : request(`tracker_bozos?week_start=eq.${week}&member_id=eq.${member}`, { method: 'DELETE' });
}

export function changeTurn(week, member) {
  return request(`tracker_weeks?week_start=eq.${week}`, { method: 'PATCH', body: { assigned_member_id: member } });
}
