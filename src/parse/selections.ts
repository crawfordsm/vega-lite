import {Model} from '../compile/Model';
import * as u from '../util';

export enum Types {
  DATA   = 'data'   as any,
  VISUAL = 'visual' as any
}

export enum Stores {
  POINT  = 'point'  as any,
  POINTS = 'points' as any
}

export interface Selection {
  name:  string;
  type:  Types;
  store: Stores;
  on: string;
  predicate: string;

  // Transforms
  project?: any;
  toggle?: any;
  interval?: any;
}

export function storeName(sel:Selection) {
  return sel.name + (sel.store === Stores.POINTS ? '_db' : '');
}

export function parseSelections(model: Model) {
  var select = model.spec().select;
  u.keys(select).forEach(function(k) {
    var sel:Selection = select[k];

    // Set defaults.
    sel.name = k;
    sel.on = sel.on || 'click';

    // Parse transformations.
    parseProjection(sel);
    parseToggle(sel);

    model.selection(k, sel);
  });
}

// TODO: parse full FieldDefs and ChannelRefs.
// Short form project: ['fieldName']
function parseProjection(sel:Selection) {
  sel.project = u.array(sel.project);
  if (sel.project.length) {
    sel.project = sel.project.map(function(p) {
      return u.isString(p) ? {field: p} : p;
    });
  } else if (sel.type === Types.DATA) {
    sel.project = [{field: '_id'}];
  }

  if (sel.store === Stores.POINT) {
    sel.predicate = sel.project.map(function(p) {
      return 'datum.'+p.field+ ' === '+sel.name+'._'+p.field
    }).join(' && ');
  } else if (sel.store === Stores.POINTS) {
    sel.predicate = sel.project.map(function(p) {
      return "indata('"+storeName(sel)+"', datum."+p.field+", '_"+p.field+"')";
    }).join(' && ');
  }
}

function parseToggle(sel:Selection) {
  // TODO: Warn!
  if (sel.store !== Stores.POINTS) return;
  if (sel.interval) return;

  sel.toggle = {
    name: sel.name + '_toggle',
    on: u.isString(sel.toggle) ? sel.toggle : sel.on+'[event.shiftKey]'
  };
}