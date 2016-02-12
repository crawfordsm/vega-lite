import * as u from '../util';

export function compileProductionRule(model, channel, output, cb) {
  const ruleDef = model.fieldDef(channel, true),
        rules   = ruleDef.rule;

  // RuleDef is just a regular FieldDef.
  if (!rules || rules.length === 0) return u.extend(output, cb(ruleDef));

  rules.forEach(function(rule) {
    const ks = u.keys(rule);
    var selName, selection, fieldDef;

    if (ks.length === 1 && !rule.value) {
      selection = model.selection(selName=ks[0]);
      fieldDef  = rule[selName];
    } else {
      fieldDef = rule;
    }

    const property = cb(fieldDef);
    u.keys(property).forEach(function(k) {
      const o = u.isArray(output[k]) && output[k] || (output[k] = []);
      if (selName) property[k].test = selection.query;
      o.push(property[k]);
    });
  });
}