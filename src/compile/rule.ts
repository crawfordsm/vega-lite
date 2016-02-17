import * as u from '../util';
import {Selection} from '../parse/selections';

export function compileProductionRule(model, channel, output, cb) {
  const ruleDef = model.fieldDef(channel, true),
        rules   = ruleDef.rule;

  // RuleDef is just a regular FieldDef.
  if (!rules || rules.length === 0) return u.extend(output, cb(ruleDef));

  rules.forEach(function(fieldDef) {
    var selName = fieldDef.selection,
        sel:Selection = selName && model.selection(selName);

    const property = cb(fieldDef);
    u.keys(property).forEach(function(k) {
      const o = u.isArray(output[k]) && output[k] || (output[k] = []);
      if (selName) property[k].test = sel.predicate;
      o.push(property[k]);
    });
  });
}