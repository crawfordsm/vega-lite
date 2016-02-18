import * as s from './';
import * as u from '../../util';

// TODO: parse full FieldDefs and ChannelRefs.
// Short form project: ['fieldName']
export function parse(sel:s.Selection) {
  sel.project = u.array(sel.project).map(function(p) {
    return u.isString(p) ? {field: p} : p;
  });

  if (sel.store === s.Stores.POINT) {
    sel.predicate = sel.project.map(function(p) {
      return 'datum.'+p.field+ ' === '+sel.name+'._'+p.field
    }).join(' && ');
  } else if (sel.store === s.Stores.POINTS) {
    sel.predicate = sel.project.map(function(p) {
      return "indata('"+s.storeName(sel)+"', datum."+p.field+", '_"+p.field+"')";
    }).join(' && ');
  }
}

export function compileSignals(sel:s.Selection, trigger) {
  trigger.streams[0].expr = '{'+sel.project.map(function(p) {
    return p.field ? '_'+p.field + ': datum.' + p.field : '';
  }).join(', ')+'}';
}