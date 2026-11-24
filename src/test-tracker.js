const key = 'bozo-lay-tracker-sandbox-v1';
const firstWeek = '2030-01-07';
const weekMs = 7 * 86400000;

export function createTestTracker(memberCount) {
  const emptyWeek = (assigned) => ({ assigned, finalized: false, picks: {}, bozos: [] });

  function read() {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { [firstWeek]: emptyWeek(1) };
  }

  function edit(week, change) {
    const weeks = read();
    const entry = weeks[week];
    if (!entry || entry.finalized) throw new Error('This test weekend is closed');
    change(entry, weeks);
    localStorage.setItem(key, JSON.stringify(weeks));
  }

  return {
    async loadWeeks() {
      return Object.fromEntries(Object.entries(read()).sort(([left], [right]) => right.localeCompare(left)));
    },
    savePick(week, member, text) {
      edit(week, (entry) => {
        if (text) entry.picks[member] = text;
        else delete entry.picks[member];
      });
    },
    setBozo(week, member, marked) {
      edit(week, (entry) => {
        if (marked && Object.keys(entry.picks).length !== memberCount) throw new Error('Save all picks first');
        entry.bozos = marked ? [...new Set([...entry.bozos, member])] : entry.bozos.filter((id) => id !== member);
      });
    },
    changeTurn(week, member) {
      edit(week, (entry) => { entry.assigned = member; });
    },
    finalizeWeek(week) {
      edit(week, (entry, weeks) => {
        if (Object.keys(entry.picks).length !== memberCount || !entry.bozos.length) {
          throw new Error('Save all picks and mark at least one BOZO first');
        }
        const next = new Date(Date.parse(week) + weekMs).toISOString().slice(0, 10);
        const index = (Date.parse(next) - Date.parse(firstWeek)) / weekMs;
        entry.finalized = true;
        weeks[next] = emptyWeek(index % memberCount + 1);
      });
    },
  };
}
