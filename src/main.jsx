import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, Card, Icon, ProgressBar, Tab, Tabs, TextArea } from '@blueprintjs/core';
import 'modern-normalize/modern-normalize.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import './styles.css';
import { changeTurn, ensureWeek, loadWeeks, savePick, setBozo } from './tracker-api.js';

const roster = ['Jack', 'Danny', 'Carl', 'Chase', 'Kyle'];
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
const weekendLabel = (start) => {
  const monday = Date.parse(start);
  return dateFormat.formatRange(new Date(monday + 5 * day), new Date(monday + 6 * day));
};

function BozoButton({ name, marked, disabled, onClick }) {
  return <Button className="bozo-button" large intent="danger" disabled={disabled}
    aria-label={`BOZO for ${name}`} aria-pressed={marked} onClick={onClick}
    text={marked ? '🤡 BOZO ✓' : '🤡 BOZO'} />;
}

function PickRow({ name, pick, marked, disabled, save, toggleBozo }) {
  const [draft, setDraft] = useState(null);
  const text = (draft ?? pick).trim();
  const changed = text !== pick;

  async function submit() {
    if (changed && await save(text)) setDraft(null);
  }

  return (
    <form className="pick-row" onSubmit={(event) => {
      event.preventDefault();
      void submit();
    }}>
      <div className="row-heading">
        <div className="person">
          <span className="avatar" aria-hidden="true">{name[0]}</span>
          <label htmlFor={`pick-${name}`}>{name}</label>
        </div>
        <BozoButton name={name} marked={marked} disabled={disabled} onClick={toggleBozo} />
      </div>
      <div className="pick-input">
        <TextArea id={`pick-${name}`} fill rows={1} maxLength={2000}
          value={draft ?? pick} readOnly={disabled} placeholder="Enter a pick…"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (!text && !disabled) void submit(); }} />
        <Button type="submit" text={text ? 'Save' : 'Clear'} intent="primary"
          aria-label={`${text ? 'Save' : 'Clear'} ${name}’s pick`}
          disabled={!changed || disabled} />
      </div>
    </form>
  );
}

function History({ weeks, busy, toggleBozo }) {
  const entries = Object.entries(weeks).filter(([key, entry]) =>
    key < weekKey && (Object.keys(entry.picks).length || entry.bozos.length));
  if (!entries.length) return <Card className="empty">Past weekends will appear here.</Card>;
  return entries.map(([key, entry]) => (
    <Card key={key} className="history-card">
      <h2>Wkend {weekendLabel(key)}, {new Date(Date.parse(key) + 6 * day).getUTCFullYear()}</h2>
      <p>{roster[entry.assigned - 1]} was putting in the Lay</p>
      <ul>{roster.map((name, index) => {
        const member = index + 1;
        const marked = entry.bozos.includes(member);
        return <li key={name}><strong>{name}</strong><span>{entry.picks[member] ?? 'No pick'}</span>
          <BozoButton name={name} marked={marked} disabled={busy}
            onClick={() => toggleBozo(key, member, !marked)} />
        </li>;
      })}</ul>
    </Card>
  ));
}

const firstWeek = '2026-11-23';
const rotationIndex = Math.round((week - Date.parse(firstWeek)) / (7 * day));
const assigned = ((rotationIndex % roster.length) + roster.length) % roster.length + 1;

function App() {
  const [weeks, setWeeks] = useState(null);
  const [tab, setTab] = useState('current');
  const [manage, setManage] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const latestRead = useRef(0);
  const entry = weeks?.[weekKey] ?? { assigned, picks: {}, bozos: [] };
  const count = Object.keys(entry.picks).length;

  async function refresh() {
    const read = ++latestRead.current;
    try {
      const next = await loadWeeks();
      if (read === latestRead.current) {
        setWeeks(next);
        setLoadError(false);
      }
    } catch {
      if (read === latestRead.current) setLoadError(true);
    }
  }

  useEffect(() => {
    function sync() {
      if (!writing.current && document.visibilityState === 'visible') void refresh();
    }
    sync();
    const timer = setInterval(sync, 5000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      latestRead.current++;
    };
  }, []);

  async function update(key, action, apply, message) {
    if (writing.current) return false;
    writing.current = true;
    latestRead.current++;
    setBusy(true);
    try {
      if (key === weekKey && !weeks?.[key]) await ensureWeek(key, assigned);
      await action();
      setWeeks((current) => ({
        ...current, [key]: apply(current?.[key] ?? { assigned, picks: {}, bozos: [] }),
      }));
      setNotice(message);
      return true;
    } catch {
      setNotice('Couldn’t save that change. Try again.');
      return false;
    } finally {
      setBusy(false);
      writing.current = false;
      void refresh();
    }
  }

  function toggleBozo(key, member, marked) {
    return update(key, () => setBozo(key, member, marked), (current) => ({
      ...current,
      bozos: marked ? [...new Set([...current.bozos, member])] : current.bozos.filter((id) => id !== member),
    }), marked ? `${roster[member - 1]} is a BOZO.` : 'BOZO mark removed.');
  }

  const current = (
    <>
      <section className="feature" aria-label="Weekly assignment">
        <div>
          <span className="feature-label"><Icon icon="calendar" /> Wkend {weekendLabel(weekKey)}</span>
          <h2>{roster[entry.assigned - 1]} is putting in the Lay</h2>
        </div>
        <div className="deadline"><Icon icon="time" /><div>Pick deadline<strong>Sat · Noon ET</strong></div></div>
      </section>
      <section className="picks" aria-labelledby="picks-heading">
        <div className="picks-heading"><h2 id="picks-heading">Weekly picks</h2><span>{count} of {roster.length} in</span></div>
        <ProgressBar value={count / roster.length} stripes={false} animate={false} aria-label="Pick submissions" />
        {manage && <label className="grade assignment">Putting in the Lay
          <select value={entry.assigned} disabled={busy || !weeks} onChange={(event) => {
            const member = Number(event.target.value);
            void update(weekKey, () => changeTurn(weekKey, member), (current) => ({ ...current, assigned: member }), 'Turn updated.');
          }}>
            {roster.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>}
        {weeks && roster.map((name, index) => {
          const member = index + 1;
          const marked = entry.bozos.includes(member);
          return <PickRow key={name} name={name} pick={entry.picks[member] ?? ''}
            marked={marked} disabled={busy} toggleBozo={() => toggleBozo(weekKey, member, !marked)}
            save={(text) => update(weekKey, () => savePick(weekKey, member, text), (current) => {
              const picks = { ...current.picks };
              if (text) picks[member] = text;
              else delete picks[member];
              return { ...current, picks };
            }, `${name}’s pick ${text ? 'saved' : 'cleared'}.`)} />;
        })}
        <div className="actions">
          <Button minimal icon="edit" text={manage ? 'Done editing' : 'Edit turn'}
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
        {loadError && <Callout intent="warning">Couldn’t refresh shared picks. Reconnecting automatically.</Callout>}
        {!weeks && !loadError && <p role="status">Loading picks…</p>}
        <Tabs id="tracker-navigation" selectedTabId={tab} onChange={setTab}>
          <Tab id="current" title="This week" panel={current} />
          <Tab id="history" title="History" panel={weeks &&
            <History weeks={weeks} busy={busy} toggleBozo={toggleBozo} />} />
        </Tabs>
        <footer role="status">{notice}</footer>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
