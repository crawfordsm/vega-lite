// utility for a field definition object

import {FieldDef} from './schema/fielddef.schema';
import {contains, getbins} from './util';
import {NOMINAL, ORDINAL, QUANTITATIVE, TEMPORAL} from './type';
import {TimeUnit} from './timeunit';
import {AggregateOp} from './aggregate';


export interface FieldRefOption {
  /** exclude bin, aggregate, timeUnit */
  nofn?: boolean;
  /** exclude aggregation function */
  noAggregate?: boolean;
  /** include 'datum.' */
  datum?: boolean;
  /** replace fn with custom function prefix */
  fn?: string;
  /** prepend fn with custom function prefix */
  prefn?: string;
  /** append suffix to the field ref for bin (default='_start') */
  binSuffix?: string;
  /** append suffix to the field ref (general) */
  suffix?: string;
}

export function field(fieldDef: FieldDef, opt: FieldRefOption = {}) {
  const prefix = (opt.datum ? 'datum.' : '') + (opt.prefn || '');
  const suffix = opt.suffix || '';
  const field = fieldDef.field;

  if (isCount(fieldDef)) {
    return prefix + 'count' + suffix;
  } else if (opt.fn) {
    return prefix + opt.fn + '_' + field + suffix;
  } else if (!opt.nofn && fieldDef.bin) {
    return prefix + 'bin_' + field + (opt.binSuffix || suffix || '_start');
  } else if (!opt.nofn && !opt.noAggregate && fieldDef.aggregate) {
    return prefix + fieldDef.aggregate + '_' + field + suffix;
  } else if (!opt.nofn && fieldDef.timeUnit) {
    return prefix + fieldDef.timeUnit + '_' + field + suffix;
  } else {
    return prefix + field;
  }
}

function _isFieldDimension(fieldDef: FieldDef) {
  return contains([NOMINAL, ORDINAL], fieldDef.type) || !!fieldDef.bin ||
    (fieldDef.type === TEMPORAL && !!fieldDef.timeUnit);
}

export function isDimension(fieldDef: FieldDef) {
  return fieldDef && fieldDef.field && _isFieldDimension(fieldDef);
}

export function isMeasure(fieldDef: FieldDef) {
  return fieldDef && fieldDef.field && !_isFieldDimension(fieldDef);
}

export const COUNT_DISPLAYNAME = 'Number of Records';

export function count(): FieldDef {
  return { field: '*', aggregate: AggregateOp.COUNT, type: QUANTITATIVE, displayName: COUNT_DISPLAYNAME };
}

export function isCount(fieldDef: FieldDef) {
  return fieldDef.aggregate === AggregateOp.COUNT;
}

// FIXME remove this, and the getbins method
// FIXME this depends on channel
export function cardinality(fieldDef: FieldDef, stats, filterNull = {}) {
  // FIXME need to take filter into account

  const stat = stats[fieldDef.field],
  type = fieldDef.type;

  if (fieldDef.bin) {
    // need to reassign bin, otherwise compilation will fail due to a TS bug.
    const bin = fieldDef.bin;
    let maxbins = (typeof bin === 'boolean') ? undefined : bin.maxbins;
    if (maxbins === undefined) {
      maxbins = 10;
    }

    const bins = getbins(stat, maxbins);
    return (bins.stop - bins.start) / bins.step;
  }
  if (type === TEMPORAL) {
    const timeUnit = fieldDef.timeUnit;
    switch (timeUnit) {
      case TimeUnit.SECONDS: return 60;
      case TimeUnit.MINUTES: return 60;
      case TimeUnit.HOURS: return 24;
      case TimeUnit.DAY: return 7;
      case TimeUnit.DATE: return 31;
      case TimeUnit.MONTH: return 12;
      case TimeUnit.YEAR:
        const yearstat = stats['year_' + fieldDef.field];

        if (!yearstat) { return null; }

        return yearstat.distinct -
          (stat.missing > 0 && filterNull[type] ? 1 : 0);
    }
    // otherwise use calculation below
  }
  if (fieldDef.aggregate) {
    return 1;
  }

  // remove null
  return stat.distinct -
    (stat.missing > 0 && filterNull[type] ? 1 : 0);
}

export function title(fieldDef: FieldDef) {
  if (isCount(fieldDef)) {
    return COUNT_DISPLAYNAME;
  }
  const fn = fieldDef.aggregate || fieldDef.timeUnit || (fieldDef.bin && 'bin');
  if (fn) {
    return fn.toString().toUpperCase() + '(' + fieldDef.field + ')';
  } else {
    return fieldDef.field;
  }
}
