import * as s from './';
import * as u from '../../util';

// _id should be exported as __id to prevent conflicts with Vega tuples.
export function fieldName(p) {
  return p.field === '_id' ? '__id' : p.field;
}

// TODO: parse full FieldDefs and ChannelRefs.
// Short form project: ['fieldName']
export function parse(_, sel: s.Selection) {
  sel.project = u.array(sel.project).map(function(p) {
    return u.isString(p) ? {field: p} : p;
  });

  if (sel.store === s.Stores.POINT) {
    sel.predicate = sel.project.map(function(p) {
      return 'datum.'+p.field+ ' === '+sel.name+'.'+fieldName(p)
    }).join(' && ');
  } else if (sel.store === s.Stores.POINTS) {
    sel.predicate = sel.project.map(function(p) {
      return "indata('"+s.storeName(sel)+"', datum."+p.field+", '"+fieldName(p)+"')";
    }).join(' && ');
  }
}

export function compileSignals(_, sel: s.Selection, trigger) {
  trigger.streams[0].expr = '{'+sel.project.map(function(p) {
    return fieldName(p) + ': datum.' + p.field;
  }).join(', ')+'}';
}