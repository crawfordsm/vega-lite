import {Model} from './Model';
import {Types as SelectionTypes, Selection} from '../parse/selections';
import {isString} from '../util';

interface VgSignal {
  name: string;
  init?: any;
  verbose: boolean;
  streams: any;
}

export function compileSignals(model: Model): VgSignal[] {
  var signals:VgSignal[] = [];

  model.selection().forEach(function(sel:Selection) {
    // Every selection will have a trigger.
    compileTrigger(sel, signals);

    if (sel.toggle) compileToggle(sel, signals);
  });

  return signals;
}

function compileTrigger(sel:Selection, signals:VgSignal[]) {
  var expr = sel.project.map(function(p) {
    return p.field ? '_'+p.field + ': datum.' + p.field : '';
  }).join(', ');

  signals.push({
    name: sel.name,
    verbose: true,  // TODO: can we intuit this from the type?
    init: {},
    streams: [{
      type: sel.on,
      expr: '{'+expr+'}'
    }]
  });
}

function compileToggle(sel:Selection, signals:VgSignal[]) {
  signals.push({
    name: sel.toggle.name,
    verbose: true,
    init: false,
    streams: [
      // The first stream mimics sel.on to unset collection.
      {type: sel.on, expr: 'false'},
      {type: sel.toggle.on, expr: 'true'}
    ]
  });
}