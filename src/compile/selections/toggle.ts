import * as s from './';
import * as u from '../../util';

function check(sel) {
  // TODO: Warn!
  return sel.store === s.Stores.POINTS && !sel.interval;
}

export function parse(sel:s.Selection) {
  if (!check(sel)) return;
  sel.toggle = u.isString(sel.toggle) ? sel.toggle : sel.on+'[event.shiftKey]';
}

export function compileSignals(sel:s.Selection, trigger, clear, signals) {
  if (!check(sel)) return;

  // Trigger contains the initial "on", which restarts the selections.
  // Toggle should append an additional stream for toggling.
  var streams = trigger.streams, expr = streams[0].expr;
  streams.push({ type: sel.toggle, expr: expr });
  clear.streams.push({ type: sel.toggle, expr: 'false' });
}

export function compileData(sel:s.Selection, db) {
  if (!check(sel)) return;
  db.modify.push({ type: 'toggle', signal: sel.name });
}