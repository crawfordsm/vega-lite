import {Model} from './Model';
import {compileSignals as selections} from './selections';
import {isString} from '../util';

interface VgSignal {
  name: string;
  init?: any;
  verbose: boolean;
  streams: any;
}

export function compileSignals(model: Model): VgSignal[] {
  return [].concat(selections(model));
}