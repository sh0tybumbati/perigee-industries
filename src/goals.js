// Goals and the endgame (GDD 2.21). Every objective is a pure test of the game state, so nothing here needs
// bookkeeping beyond the day each one was done. This file depends only on data and base, so the sim can import it.
import { MARKETS, OVERHEAD_PER_DAY } from './data.js';
import { analyze } from './base.js';

export const COLONY_DAYS = 180;
const CATCH_TYPES = ['behemoth', 'skyship', 'skyshipTanker', 'skyshipDepot'];

const flights = (s) => Object.values(s.flightCounts).reduce((n, c) => n + c, 0);
const catchFlights = (s) => CATCH_TYPES.reduce((n, t) => n + (s.flightCounts[t] ?? 0), 0);
const owned = (s) => Object.values(s.sites).filter((x) => x.status === 'owned');
const padCount = (s) => owned(s).reduce((n, x) => n + x.pads.length, 0);
const subsK = (s) => MARKETS.reduce((n, m) => n + (m.cell ? 0 : s.markets[m.id].subs), 0);
const licensed = (s) => MARKETS.filter((m) => !m.cell && s.markets[m.id].status === 'active').length;
const ms = (id) => (s) => !!s.milestones?.[id];
const owns = (id) => (s) => s.sites[id]?.status === 'owned';

// The Mars colony: powered, crewed, and making its own fuel. Returns what is still missing.
export function colonyCheck(s) {
  const base = s.marsBase;
  const missing = [];
  if (!base) return { ok: false, missing: ['No Mars base'] };
  const { byModule } = analyze(base);
  const habs = base.modules.filter((m) => m.type === 'habitat');
  const crewed = habs.filter((m) => m.crew > 0);
  if (crewed.length < 3) missing.push(`Crewed habitats ${crewed.length} / 3`);
  const unpowered = habs.filter((m) => (byModule.get(m.id)?.powerFactor ?? 0) <= 0).length;
  if (unpowered) missing.push(`${unpowered} habitat${unpowered > 1 ? 's' : ''} without power`);
  for (const [type, name] of [['icer', 'an Ice Miner'], ['refinery', 'a Refinery']]) {
    if (!base.modules.some((m) => m.type === type && (byModule.get(m.id)?.work ?? 0) > 0)) missing.push(`No working ${name === 'an Ice Miner' ? 'Ice Miner' : 'Refinery'}`);
  }
  if (!s.milestones?.marsReturn) missing.push('No Mars-based Skyship has flown home yet');
  return { ok: missing.length === 0, missing };
}

// have/need pairs show progress in the Goals panel.
export const CHAPTERS = [
  { id: 'orbit', name: 'Orbit', grant: 5, goals: [
    { id: 'firstFlight', text: 'First successful flight', done: ms('firstFlight') },
    { id: 'flights10', text: '10 successful flights', done: (s) => flights(s) >= 10, prog: (s) => [flights(s), 10] },
    { id: 'landing', text: 'Land a booster (Booster Landing research)', done: (s) => s.tech.has('landing') },
    { id: 'reflown', text: 'Fly a booster again', done: ms('reflown') },
  ] },
  { id: 'bills', name: 'Pay the Bills', grant: 10, goals: [
    { id: 'gen1', text: 'Research Skylink Gen-1', done: (s) => s.tech.has('gen1') },
    { id: 'market1', text: 'License a broadband market', done: (s) => licensed(s) >= 1 },
    { id: 'profit30', text: 'Net income positive for 30 days', done: (s) => (s.profitDays ?? 0) >= 30, prog: (s) => [Math.min(30, s.profitDays ?? 0), 30] },
    { id: 'subs50', text: '50k Skylink subscribers', done: (s) => subsK(s) >= 50 || !!s.milestones?.subs50, prog: (s) => [Math.round(subsK(s)), 50] },
  ] },
  { id: 'pads', name: 'Own the Pads', grant: 25, goals: [
    { id: 'buyCape', text: 'Buy Cape Canaveral', done: owns('cape') },
    { id: 'twoSites', text: 'Own two launch sites', done: (s) => owned(s).length >= 2, prog: (s) => [owned(s).length, 2] },
    { id: 'pads3', text: 'Run three pads', done: (s) => padCount(s) >= 3, prog: (s) => [padCount(s), 3] },
  ] },
  { id: 'superheavy', name: 'Super-Heavy', grant: 60, goals: [
    { id: 'skyship', text: 'Operational Skyship', done: (s) => s.tech.has('skyship') },
    { id: 'depot', text: 'LEO depot online', done: (s) => !!s.depot?.built },
    { id: 'boca', text: 'Buy Boca Chica', done: owns('boca') },
    { id: 'catch50', text: '50 flights with catch-tower vehicles', done: (s) => catchFlights(s) >= 50, prog: (s) => [catchFlights(s), 50] },
  ] },
  { id: 'moon', name: 'The Moon', grant: 120, goals: [
    { id: 'firstMoon', text: 'First cargo on the Moon', done: ms('firstMoon') },
    { id: 'moonBase', text: 'Found a Moon base', done: (s) => !!s.base?.modules?.length },
    { id: 'moonCrew', text: 'A crewed habitat on a powered Moon base', done: (s) => {
      if (!s.base) return false;
      const { byModule } = analyze(s.base);
      return s.base.modules.some((m) => m.type === 'habitat' && m.crew > 0 && (byModule.get(m.id)?.powerFactor ?? 0) > 0);
    } },
    { id: 'moonFuel', text: 'Lunar methalox in the stockpile', done: (s) => (s.base?.stock?.methalox ?? 0) >= 1 },
  ] },
  { id: 'mars', name: 'The Red Planet', grant: 250, goals: [
    { id: 'firstMars', text: 'First delivery to Mars', done: ms('firstMars') },
    { id: 'marsBase', text: 'Found a Mars base', done: (s) => !!s.marsBase?.modules?.length },
    { id: 'marsReturn', text: 'First flight home from Mars', done: ms('marsReturn') },
  ] },
  { id: 'colony', name: 'A Colony', grant: 0, goals: [
    { id: 'colony', text: `Hold the colony conditions for ${COLONY_DAYS} days`, done: (s) => !!s.won, prog: (s) => [Math.min(COLONY_DAYS, s.colonyDays ?? 0), COLONY_DAYS] },
  ] },
];

export const GOAL_IDS = CHAPTERS.flatMap((c) => c.goals.map((g) => g.id));
export const chapterDone = (s, ch) => ch.goals.every((g) => s.goals?.[g.id] != null);
// The first chapter that is not finished, or null once the colony is won.
export const currentChapter = (s) => CHAPTERS.find((c) => !chapterDone(s, c)) ?? null;
export const goalProgress = (s, g) => g.prog?.(s) ?? null;

// Older saves: whatever is already true counts as done today, and finished chapters pay nothing again.
export function adoptGoals(s) {
  s.goals = {};
  s.chaptersPaid = {};
  s.profitDays = 0;
  s.colonyDays = 0;
  s.won = null;
  for (const ch of CHAPTERS) {
    for (const g of ch.goals) if (g.id !== 'colony' && g.done(s)) s.goals[g.id] = s.day;
    if (!chapterDone(s, ch)) break;
    s.chaptersPaid[ch.id] = true;
  }
}

// Runs once a day at the end of the tick. hooks: { milestone(id, title, text) for chapters, note(msg, kind) for goals, victory() }.
export function tickGoals(s, hooks) {
  s.goals ??= {};
  s.chaptersPaid ??= {};
  s.profitDays = s.income - OVERHEAD_PER_DAY >= 0 ? (s.profitDays ?? 0) + 1 : 0;
  for (let guard = 0; guard < CHAPTERS.length; guard++) {
    const ch = currentChapter(s);
    if (!ch) return;
    if (ch.id === 'colony' && !s.won) {
      const c = colonyCheck(s);
      s.colonyDays = c.ok ? (s.colonyDays ?? 0) + 1 : 0;
      s.colonyMissing = c.missing;
      if (s.colonyDays >= COLONY_DAYS) { s.won = s.day; hooks.victory?.(); }
    }
    for (const g of ch.goals) {
      if (s.goals[g.id] != null || !g.done(s)) continue;
      s.goals[g.id] = s.day;
      hooks.note(`Goal done: ${g.text}`, 'good');
    }
    if (!chapterDone(s, ch)) return;
    if (!s.chaptersPaid[ch.id]) {
      s.chaptersPaid[ch.id] = true;
      if (ch.grant) s.cash += ch.grant;
      hooks.milestone(`chapter:${ch.id}`, `Chapter complete: ${ch.name}`, ch.grant ? `Investors grant $${ch.grant}M.` : 'The colony stands.');
    }
  }
}
