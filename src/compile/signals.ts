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
    if (sel.type === SelectionTypes.DATUM) {
      compileDatumSignal(sel, signals);
    }

    if (sel.collect) {
      compileCollectSignal(sel, signals);
    }
  });

  return signals;
}

function compileDatumSignal(sel:Selection, signals:VgSignal[]) {
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

function compileCollectSignal(sel:Selection, signals:VgSignal[]) {
  signals.push({
    name: sel.collect.name,
    verbose: true,
    init: false,
    streams: [
      // The first stream mimics sel.on to unset collection.
      {type: sel.on, expr: 'false'},
      {type: sel.collect.on, expr: 'true'}
    ]
  });
}