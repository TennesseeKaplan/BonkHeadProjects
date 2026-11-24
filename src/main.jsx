import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, Card, Icon, ProgressBar, Tab, Tabs, Tag, TextArea } from '@blueprintjs/core';
import 'modern-normalize/modern-normalize.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import './styles.css';

const roster = ['Jack', 'Danny', 'Carl', 'Chase', 'Kyle'];
const outcomes = { won: 'Won', lost: 'Lost', pushed: 'Push', voided: 'Void' };
const storageKey = 'bozo-lay-tracker-v1';
const day = 86400000;
const zone = 'America/New_York';

// Use Eastern calendar dates for the weekly rotation across daylight saving changes.
function monday(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(value);
  const part = (type) => Number(parts.find((item) => item.type === type).value);
  const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  return date.getTime() - ((date.getUTCDay() + 6) % 7) * day;
}

const week = monday(new Date());
const weekKey = new Date(week).toISOString().slice(0, 10);
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});
const weekLabel = (start) => {
  const date = new Date(start);
  return dateFormat.formatRange(date, new Date(date.getTime() + 6 * day));
};

function initialData() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data?.firstWeek && data?.weeks) return data;
  } catch {
    // The app can still open when storage is unavailable.
  }
  return { firstWeek: weekKey, weeks: {} };
}

function ResultSelect({ outcome, onChange }) {
  return (
    <select value={outcome ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">Pending</option>
      {Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
}

function PickRow({ name, pick, save, grade }) {
  const [draft, setDraft] = useState(pick?.text ?? '');
  const text = draft.trim();
  return (
    <form className="pick-row" onSubmit={(event) => {
      event.preventDefault();
      if (text && text !== pick?.text && !pick?.outcome) save(text);
    }}>
      <div className="row-heading">
        <div className="person">
          <span className="avatar" aria-hidden="true">{name[0]}</span>
          <label htmlFor={`pick-${name}`}>{name}</label>
        </div>
        <Tag minimal intent={pick?.outcome === 'lost' ? 'danger' : pick ? 'success' : 'none'}>
          {outcomes[pick?.outcome] ?? (pick ? 'Submitted' : 'Missing pick')}
        </Tag>
      </div>
      <div className="pick-input">
        <TextArea id={`pick-${name}`} fill rows={1} maxLength={2000} value={draft}
          placeholder="Enter a pick…" readOnly={Boolean(pick?.outcome)}
          onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" text="Save" intent="primary" aria-label={`Save ${name}’s pick`}
          disabled={!text || text === pick?.text || Boolean(pick?.outcome)} />
      </div>
      {grade && pick && (
        <label className="grade">
          Result
          <ResultSelect outcome={pick.outcome} onChange={grade} />
        </label>
      )}
    </form>
  );
}

function History({ weeks, grade }) {
  const entries = Object.entries(weeks).filter(([key]) => key < weekKey).sort(([a], [b]) => b.localeCompare(a));
  if (!entries.length) return <Card className="empty">Past weeks will appear here after you save picks.</Card>;
  return entries.map(([key, entry]) => {
    const losses = roster.filter((name) => entry.picks[name]?.outcome === 'lost');
    return (
      <Card key={key} className="history-card">
        <h2>{weekLabel(key)}, {key.slice(0, 4)}</h2>
        <p>{entry.assigned} was on the slip</p>
        {losses.length > 0 && <Callout intent="danger">Broke the parlay: {losses.join(', ')}</Callout>}
        <ul>{roster.map((name) => {
          const pick = entry.picks[name];
          return <li key={name}><strong>{name}</strong><span>{pick?.text ?? 'No pick'}</span>
            {pick && <><Tag minimal intent={pick.outcome === 'lost' ? 'danger' : 'none'}>
              {outcomes[pick.outcome] ?? 'Pending'}</Tag>
              <label className="grade history-grade">
                Result for {name}
                <ResultSelect outcome={pick.outcome} onChange={(outcome) => grade(key, name, outcome)} />
              </label></>}</li>;
        })}</ul>
      </Card>
    );
  });
}

function App() {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState('current');
  const [manage, setManage] = useState(false);
  const [notice, setNotice] = useState('');
  const diff = Math.round((week - Date.parse(data.firstWeek)) / (7 * day));
  const assigned = roster[((diff % roster.length) + roster.length) % roster.length];
  const entry = data.weeks[weekKey] ?? { assigned, picks: {} };
  const count = roster.filter((name) => entry.picks[name]).length;

  function update(next, message, key = weekKey) {
    const nextData = { ...data, weeks: { ...data.weeks, [key]: next } };
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextData));
      setData(nextData);
      setNotice(message);
    } catch {
      setNotice('Couldn’t save. Check that browser storage is available.');
    }
  }

  const current = (
    <>
      <section className="feature" aria-label="Weekly assignment">
        <div>
          <span className="feature-label"><Icon icon="calendar" /> WEEK OF {weekLabel(weekKey)}</span>
          <h2>{entry.assigned}’s up</h2>
          <p>On the slip this week</p>
        </div>
        <div className="deadline"><Icon icon="time" /><div>Pick deadline<strong>Sat · Noon ET</strong></div></div>
      </section>
      <section className="picks" aria-labelledby="picks-heading">
        <div className="picks-heading">
          <h2 id="picks-heading">Weekly picks</h2>
          <span>{count} of {roster.length} in</span>
        </div>
        <ProgressBar value={count / roster.length} stripes={false} animate={false} aria-label="Pick submissions" />
        {manage && <label className="grade assignment">On the slip
          <select value={entry.assigned} onChange={(event) => update({ ...entry, assigned: event.target.value }, 'Turn updated.')}>
            {roster.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>}
        {roster.map((name) => (
          <PickRow key={name} name={name} pick={entry.picks[name]}
            save={(text) => update({ ...entry, picks: { ...entry.picks, [name]: { text } } }, `${name}’s pick saved.`)}
            grade={manage ? (outcome) => update({ ...entry, picks: {
              ...entry.picks, [name]: { ...entry.picks[name], outcome },
            } }, `${name}’s result updated.`) : undefined}
          />
        ))}
        <div className="actions">
          <span>{notice}</span>
          <Button minimal icon="edit" text={manage ? 'Done editing' : 'Edit turn & results'}
            aria-pressed={manage} onClick={() => setManage(!manage)} />
        </div>
      </section>
    </>
  );

  return (
    <>
      <header className="masthead"><div className="masthead-inner">
        <span className="brand-icon"><Icon icon="th-list" size={22} /></span>
        <h1>Bozo Lay Tracker</h1>
      </div></header>
      <main>
        <Tabs id="tracker-navigation" selectedTabId={tab} onChange={setTab}>
          <Tab id="current" title="This week" panel={current} />
          <Tab id="history" title="History" panel={<History weeks={data.weeks} grade={(key, name, outcome) => {
            const past = data.weeks[key];
            update({ ...past, picks: { ...past.picks, [name]: { ...past.picks[name], outcome } } },
              `${name}’s result updated.`, key);
          }} />} />
        </Tabs>
        <span className="sr-only" role="status">{notice}</span>
        <footer>Frontend preview · picks are saved on this device.</footer>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
