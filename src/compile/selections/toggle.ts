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

// Trigger contains the initial "on", which restarts the selections.
// Toggle should append an additional stream for toggling.
export function compileTrigger(sel:s.Selection, trigger) {
  if (!check(sel)) return;
  var streams = trigger.streams,
      expr = streams[0].expr;
  streams.push({ type: sel.toggle, expr: expr });
}

export function compileClear(sel:s.Selection, clear) {
  if (!check(sel)) return;
  clear.streams.push({ type: sel.toggle, expr: 'false' });
}

export function compileData(sel:s.Selection, data) {
  if (!check(sel)) return;
  data.modify.push({ type: 'toggle', signal: sel.name });
}