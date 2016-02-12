import {Model} from '../compile/Model';
import * as u from '../util';

export enum Types {
  DATUM = 'datum' as any,
  POINT = 'point' as any,
  INTERVAL = 'interval' as any
}

export interface Selection {
  name: string;
  type: Types;
  project: any;
  on: string;
  collect?: any;
  query: string;
}

export function parseSelections(model: Model) {
  var select = model.spec().select;
  u.keys(select).forEach(function(k) {
    var sel:Selection = select[k];
    sel.name = k;

    if (sel.type === Types.DATUM) {
      parseDatum(sel);
    }

    model.selection(k, sel);
  });
}

function parseDatum(sel:Selection) {
  var name = sel.name,
      on = sel.on = sel.on || 'click',
      db;

  // TODO: parse full FieldDef and ChannelRefs
  // Short-form project: ['fieldName']
  sel.project = u.array(sel.project);
  if (sel.project.length) {
    sel.project = sel.project.map(function(p) {
      return u.isString(p) ? {field: p} : p;
    });
  } else {
    sel.project = [{field: '_id'}];
  }

  if (sel.collect) {
    sel.collect = {
      name: name + '_collect',
      db: (db=name + '_db'),
      on: u.isString(sel.collect) ? sel.collect+'' : sel.on + '[event.shiftKey]'
    }

    sel.query = sel.project.map(function(p) {
      return "indata('"+db+"', datum."+p.field+", '_"+p.field+"')";
    }).join(' && ');
  } else {
    sel.query = sel.project.map(function(p) {
      return 'datum.'+p.field+ ' === '+name+'._'+p.field
    }).join(' && ');
  }
}