/// <reference path="../../../typings/vega.d.ts"/>
import {Model} from '../Model';
import * as s from './';
import * as u from '../../util';
import {parse as parseEvents} from 'vega-event-selector';

function anchorName(sel: s.Selection) {
  return sel.name + '_anchor';
}

function deltaName(sel: s.Selection) {
  return sel.name + '_delta';
}

export function parse(_, sel: s.Selection) {
  var trans = sel.translate,
      on = parseEvents(u.isString(trans) ? trans :
        '[mousedown, window:mouseup] > window:mousemove');
  sel.translate = {on: on[0]};
}

export function compileSignals(model: Model, sel: s.Selection, trigger, __, signals) {
  var on = sel.translate.on,
      anchor = anchorName(sel),
      delta = deltaName(sel),
      project = sel.project;

  signals.push({
    name: delta,
    init: {x: 0, y: 0},
    streams: [{
      type: on.str,
      expr: '{x: '+anchor+'.x - eventX(), y: eventY() - '+anchor+'.y}'
    }]
  });

  signals.push({
    name: anchor,
    init: {},
    verbose: true,
    streams: [{
      type: '('+on.start.str+'), ('+on.str+')',
      expr: '{x: eventX(), y: eventY()}'
    }]
  });
}

var DIMS = {x: 'width', y: 'height'};
export function compileData(model: Model, sel: s.Selection, db) {
  var tx = db.transform, delta = deltaName(sel);
  sel.project.forEach(function(p) {
    var field = p.field, channel = p.channel,
        min = 'datum._min_'+field, max = 'datum._max_'+field;

    // To prevent aspect ratio drift, capture the current extents
    // and use them in the offset calculation. We need to insert the
    // delta signal in there to force recomputation.
    tx.push({
      type: 'formula',
      field: '_min_'+field,
      expr: 'datum.min_'+field+'*(('+delta+'.x/'+delta+'.x)||1)'
    });
    tx.push({
      type: 'formula',
      field: '_max_'+field,
      expr: 'datum.max_'+field+'*(('+delta+'.x/'+delta+'.x)||1)'
    });

    tx.push({
      type: 'formula',
      field: 'min_'+field,
      expr: min + ' + (' + max+'-'+min + ')*'+delta+'.'+channel+'/'+DIMS[channel]
    });
    tx.push({
      type: 'formula',
      field: 'max_'+field,
      expr: max + ' + (' + max+'-'+min + ')*'+delta+'.'+channel+'/'+DIMS[channel]
    });
  });
}