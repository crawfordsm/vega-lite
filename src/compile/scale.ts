// https://github.com/Microsoft/TypeScript/blob/master/doc/spec.md#11-ambient-declarations
declare var exports;

import {FieldDef} from '../schema/fielddef.schema';

import {contains, extend, vals} from '../util';
import {Model} from './Model';
import {SHARED_DOMAIN_OPS} from '../aggregate';
import {COLUMN, ROW, X, Y, SHAPE, SIZE, COLOR, TEXT, hasScale, Channel} from '../channel';
import {SOURCE, STACKED_SCALE} from '../data';
import {NOMINAL, ORDINAL, QUANTITATIVE, TEMPORAL} from '../type';
import {Mark, BAR, TEXT as TEXT_MARK} from '../mark';
import {rawDomain} from './time';
import {field} from '../fielddef';

/**
 * Color Ramp's scale for legends.  This scale has to be ordinal so that its
 * legends show a list of numbers.
 */
export const COLOR_LEGEND = 'color_legend';

// scale used to get labels for binned color scales
export const COLOR_LEGEND_LABEL = 'color_legend_label';

export function compileScales(channels: Channel[], model: Model) {
  return channels.filter(hasScale)
    .reduce(function(scales: any[], channel: Channel) {
      var fieldDef = model.fieldDef(channel);

      var scaleDef: any = {
        name: model.scaleName(channel),
        type: type(fieldDef, channel, model.mark()),
      };

      scaleDef.domain = domain(model, channel, scaleDef.type);
      extend(scaleDef, rangeMixins(model, channel, scaleDef.type));

      // Add optional properties
      [
        // general properties
        'reverse', 'round',
        // quantitative / time
        'clamp', 'nice',
        // quantitative
        'exponent', 'zero',
        // ordinal
        'outerPadding', 'padding', 'points'
      ].forEach(function(property) {
        // TODO include fieldDef as part of the parameters
        const value = exports[property](model, channel, scaleDef.type);
        if (value !== undefined) {
          scaleDef[property] = value;
        }
      });

      // Add additional scales needed to support ordinal legends (list of values)
      // for color ramp.
      if (channel === COLOR && fieldDef.legend && (fieldDef.type === ORDINAL || fieldDef.bin || fieldDef.timeUnit)) {
        // This scale is for producing ordinal scale for legends.
        // - For an ordinal field, provide an ordinal scale that maps rank values to field values
        // - For a field with bin or timeUnit, provide an identity ordinal scale
        // (mapping the field values to themselves)
        scales.push({
          name: COLOR_LEGEND,
          type: 'ordinal',
          domain: {
            data: model.dataTable(),
            // use rank_<field> for ordinal type, for bin and timeUnit use default field
            field: model.field(COLOR, (fieldDef.bin || fieldDef.timeUnit) ? {} : {prefn: 'rank_'}), sort: true
          },
          range: {data: model.dataTable(), field: model.field(COLOR), sort: true}
        });

        // bin needs an additional scale for labels because we need to map bin_start to bin_range in legends
        if (fieldDef.bin) {
          scales.push({
            name: COLOR_LEGEND_LABEL,
            type: 'ordinal',
            domain: {
              data: model.dataTable(),
              field: model.field(COLOR,  {prefn: 'rank_'}),
              sort: true
            },
            range: {
              data: model.dataTable(),
              field: field(fieldDef, {binSuffix: '_range'}),
              sort: {
                field: model.field(channel, { binSuffix: '_start' }),
                op: 'min' // min or max doesn't matter since same _range would have the same _start
              }
            }
          });
        }
      }

      scales.push(scaleDef);

      return scales;
    }, []);
}

export function type(fieldDef: FieldDef, channel: Channel, mark: Mark): string {
  if (!hasScale(channel)) {
    // There is no scale for these channels
    return null;
  }

  // We can't use linear/time for row, column or shape
  if (contains([ROW, COLUMN, SHAPE], channel)) {
    return 'ordinal';
  }

  if (fieldDef.scale.type !== undefined) {
    return fieldDef.scale.type;
  }

  switch (fieldDef.type) {
    case NOMINAL:
      return 'ordinal';
    case ORDINAL:
      if (channel === COLOR) {
        return 'linear'; // time has order, so use interpolated ordinal color scale.
      }
      return 'ordinal';
    case TEMPORAL:
      if (channel === COLOR) {
        return 'time'; // time has order, so use interpolated ordinal color scale.
      }

      if (fieldDef.timeUnit) {
        switch (fieldDef.timeUnit) {
          case 'hours':
          case 'day':
          case 'month':
            return 'ordinal';
          default:
            // date, year, minute, second, yearmonth, monthday, ...
            return 'time';
        }
      }
      return 'time';

    case QUANTITATIVE:
      if (fieldDef.bin) {
        return contains([X, Y, COLOR], channel) ? 'linear' : 'ordinal';
      }
      return 'linear';
  }

  // should never reach this
  return null;
}

export function domain(model: Model, channel:Channel, scaleType: string) {
  var fieldDef = model.fieldDef(channel);

  if (fieldDef.scale.domain) { // explicit value
    return fieldDef.scale.domain;
  }

  // special case for temporal scale
  if (fieldDef.type === TEMPORAL) {
    if (rawDomain(fieldDef.timeUnit, channel)) {
      return {
        data: fieldDef.timeUnit,
        field: 'date'
      };
    }

    return {
      data: model.dataTable(),
      field: model.field(channel),
      sort: {
        field: model.field(channel),
        op: 'min'
      }
    };
  }

  // For stack, use STACKED data.
  var stack = model.stack();
  if (stack && channel === stack.fieldChannel) {
    if(stack.offset === 'normalize') {
      return [0, 1];
    }
    return {
      data: STACKED_SCALE,
      // STACKED_SCALE produces sum of the field's value e.g., sum of sum, sum of distinct
      field: model.field(channel, {prefn: 'sum_'})
    };
  }

  var useRawDomain = _useRawDomain(model, channel, scaleType);
  var sort = domainSort(model, channel, scaleType);

  if (useRawDomain) { // useRawDomain - only Q/T
    return {
      data: SOURCE,
      field: model.field(channel, {noAggregate: true})
    };
  } else if (fieldDef.bin) { // bin
    return scaleType === 'ordinal' ? {
      // ordinal bin scale takes domain from bin_range, ordered by bin_start
      data: model.dataTable(),
      field: model.field(channel, { binSuffix: '_range' }),
      sort: {
        field: model.field(channel, { binSuffix: '_start' }),
        op: 'min' // min or max doesn't matter since same _range would have the same _start
      }
    } : channel === COLOR ? {
      // Currently, binned on color uses linear scale and thus use _start point
      data: model.dataTable(),
      field: model.field(channel, { binSuffix: '_start' })
    } : {
      // other linear bin scale merges both bin_start and bin_end for non-ordinal scale
      data: model.dataTable(),
      field: [
        model.field(channel, { binSuffix: '_start' }),
        model.field(channel, { binSuffix: '_end' })
      ]
    };
  } else if (sort) { // have sort -- only for ordinal
    return {
      // If sort by aggregation of a specified sort field, we need to use SOURCE table,
      // so we can aggregate values for the scale independently from the main aggregation.
      data: sort.op ? SOURCE : model.dataTable(),
      field: (fieldDef.type === ORDINAL && channel === COLOR) ? model.field(channel, {prefn: 'rank_'}) : model.field(channel),
      sort: sort
    };
  } else {
    return {
      data: model.dataTable(),
      field: (fieldDef.type === ORDINAL && channel === COLOR) ? model.field(channel, {prefn: 'rank_'}) : model.field(channel),
    };
  }
}

export function domainSort(model: Model, channel: Channel, scaleType: string): any {
  if (scaleType !== 'ordinal') {
    return undefined;
  }

  var sort = model.fieldDef(channel).sort;
  if (sort === 'ascending' || sort === 'descending') {
    return true;
  }

  // Sorted based on an aggregate calculation over a specified sort field (only for ordinal scale)
  if (typeof sort !== 'string') {
    return {
      op: sort.op,
      field: sort.field
    };
  }
  return undefined;
}

export function reverse(model: Model, channel: Channel) {
  var sort = model.fieldDef(channel).sort;
  return sort && (typeof sort === 'string' ?
                    sort === 'descending' :
                    sort.order === 'descending'
                 ) ? true : undefined;
}

/**
 * Determine if useRawDomain should be activated for this scale.
 * @return {Boolean} Returns true if all of the following conditons applies:
 * 1. `useRawDomain` is enabled either through scale or config
 * 2. Aggregation function is not `count` or `sum`
 * 3. The scale is quantitative or time scale.
 */
function _useRawDomain (model: Model, channel: Channel, scaleType: string) {
  const fieldDef = model.fieldDef(channel);

  return fieldDef.scale.useRawDomain && //  if useRawDomain is enabled
    // only applied to aggregate table
    fieldDef.aggregate &&
    // only activated if used with aggregate functions that produces values ranging in the domain of the source data
    SHARED_DOMAIN_OPS.indexOf(fieldDef.aggregate) >= 0 &&
    (
      // Q always uses quantitative scale except when it's binned.
      // Binned field has similar values in both the source table and the summary table
      // but the summary table has fewer values, therefore binned fields draw
      // domain values from the summary table.
      (fieldDef.type === QUANTITATIVE && !fieldDef.bin) ||
      // T uses non-ordinal scale when there's no unit or when the unit is not ordinal.
      (fieldDef.type === TEMPORAL && scaleType === 'time')
    );
}

export function bandWidth(model: Model, channel: Channel, scaleType: string) {
  if (scaleType === 'ordinal') {
    return model.fieldDef(channel).scale.bandWidth;
  }
  return undefined;
}

export function clamp(model: Model, channel: Channel) {
  // only return value if explicit value is specified.
  return model.fieldDef(channel).scale.clamp;
}

export function exponent(model: Model, channel: Channel) {
  // only return value if explicit value is specified.
  return model.fieldDef(channel).scale.exponent;
}

export function nice(model: Model, channel: Channel, scaleType: string) {
  if (model.fieldDef(channel).scale.nice !== undefined) {
    // explicit value
    return model.fieldDef(channel).scale.nice;
  }

  switch (channel) {
    case X: /* fall through */
    case Y:
      if (scaleType === 'time' || scaleType === 'ordinal') {
        return undefined;
      }
      return true;

    case ROW: /* fall through */
    case COLUMN:
      return true;
  }
  return undefined;
}

export function outerPadding(model: Model, channel: Channel, scaleType: string) {
  if (scaleType === 'ordinal') {
    if (model.fieldDef(channel).scale.outerPadding !== undefined) {
      return model.fieldDef(channel).scale.outerPadding; // explicit value
    }
  }
  return undefined;
}

export function padding(model: Model, channel: Channel, scaleType: string) {
  if (scaleType === 'ordinal' && channel !== ROW && channel !== COLUMN) {
    return model.fieldDef(channel).scale.padding;
  }
  return undefined;
}

export function points(model: Model, channel: Channel, scaleType: string) {
  if (scaleType === 'ordinal') {
    switch (channel) {
      case X:
      case Y:
        return true;
    }
  }
  return undefined;
}


export function rangeMixins(model: Model, channel: Channel, scaleType: string): any {
  var fieldDef = model.fieldDef(channel);

  if (scaleType === 'ordinal' && fieldDef.scale.bandWidth) {
    return {bandWidth: fieldDef.scale.bandWidth};
  }

  if (fieldDef.scale.range) { // explicit value
    return {range: fieldDef.scale.range};
  }

  switch (channel) {
    case X:
      // we can't use {range: "width"} here since we put scale in the root group
      // not inside the cell, so scale is reusable for axes group
      return {rangeMin: 0, rangeMax: model.layout().cellWidth};
    case Y:
      // We can't use {range: "height"} here for the same reason
      if (scaleType === 'ordinal') {
        return {rangeMin: 0, rangeMax: model.layout().cellHeight};
      }
      return {rangeMin: model.layout().cellHeight, rangeMax: 0};
    case SIZE:
      if (model.is(BAR)) {
        // TODO: determine bandSize for bin, which actually uses linear scale
        const dimension = model.config().mark.orient === 'horizontal' ? Y : X;
        return {range: [2, model.fieldDef(dimension).scale.bandWidth]};
      } else if (model.is(TEXT_MARK)) {
        return {range: [8, 40]};
      }
      // else -- point, square, circle
      const xIsMeasure = model.isMeasure(X);
      const yIsMeasure = model.isMeasure(Y);

      const bandWidth = xIsMeasure !== yIsMeasure ?
        model.fieldDef(xIsMeasure ? Y : X).scale.bandWidth :
        Math.min(
          model.fieldDef(X).scale.bandWidth || 21 /* config.scale.bandWidth */,
          model.fieldDef(Y).scale.bandWidth || 21 /* config.scale.bandWidth */
        );

      return {range: [10, (bandWidth - 2) * (bandWidth - 2)]};
    case SHAPE:
      return {range: 'shapes'};
    case COLOR:
      if (fieldDef.type === NOMINAL) {
        return {range: 'category10'};
      }
      // else -- ordinal, time, or quantitative
      return {range: ['#AFC6A3', '#09622A']}; // tableau greens
    case ROW:
      return {range: 'height'};
    case COLUMN:
      return {range: 'width'};
  }
  return {};
}

export function round(model: Model, channel: Channel) {
  if (model.fieldDef(channel).scale.round !== undefined) {
    return model.fieldDef(channel).scale.round;
  }

  // FIXME: revise if round is already the default value
  switch (channel) {
    case X: /* fall through */
    case Y:
    case ROW:
    case COLUMN:
    case SIZE:
      return true;
  }
  return undefined;
}

export function zero(model: Model, channel: Channel) {
  var fieldDef = model.fieldDef(channel);
  var timeUnit = fieldDef.timeUnit;

  if (fieldDef.scale.zero !== undefined) {
    // explicit value
    return fieldDef.scale.zero;
  }

  if (fieldDef.type === TEMPORAL) {
    if (timeUnit === 'year') {
      // year is using linear scale, but should not include zero
      return false;
    }
    // If there is no timeUnit or the timeUnit uses ordinal scale,
    // zero property is ignored by vega so we should not generate them any way
    return undefined;
  }
  if (fieldDef.bin) {
    // Returns false (undefined) by default of bin
    return false;
  }

  return channel === X || channel === Y ?
    // if not bin / temporal, returns undefined for X and Y encoding
    // since zero is true by default in vega for linear scale
    undefined :
    false;
}
