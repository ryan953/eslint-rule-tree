'use strict';

// @flow

import yargs from 'yargs'; // flowlint-line untyped-import: off
import { getTree, printTree } from './eslint-rule-tree';

export function run() {
  const args = yargs.parse();
  printTree(getTree(args.path || process.cwd()));
}
