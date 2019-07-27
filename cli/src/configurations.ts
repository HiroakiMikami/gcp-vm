/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as fs from "fs";

import { isArray, isObject, promisify } from "util";

export type Configurations = any;

export async function load(path: string): Promise<Configurations> {
  const exist = await promisify(fs.exists)(path);
  if (exist) {
    const content = await promisify(fs.readFile)(path);
    return JSON.parse(content.toString());
  } else {
    return {};
  }
}

export function copy(config: Configurations): Configurations {
  if (isArray(config)) {
    const retval: any = [];
    for (const elem of config) {
      retval.push(elem);
    }
    return retval;
  }
  if (isObject(config)) {
    const retval: any = {};
    for (const key of Object.keys(config)) {
      retval[key] = copy(config[key]);
    }
    return retval;
  } else {
    return config;
  }
}

export function merge(c1: Configurations, c2: Configurations): Configurations {
  if (isArray(c2)) {
    return copy(c2);
  }
  if (!isObject(c2)) {
    return c2;
  }

  const retval: any = {};
  if (!isArray(c1) && isObject(c1)) {
    for (const key of Object.keys(c1)) {
      retval[key] = copy(c1[key]);
    }
  }
  for (const key of Object.keys(c2)) {
    // overwrite
    retval[key] = merge(retval[key], c2[key]);
  }

  return retval;
}
