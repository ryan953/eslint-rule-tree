'use strict';

// @flow

import glob from 'glob'; // flowlint-line untyped-import: off
import fs from 'fs';
import path from 'path';

type Branch = {
  [string]: Branch | string,
};

type Tree = {
  files: Array<string>,
  branches: Branch,
  chains: {string: Array<Config>},
  configs: Object,
};

type RulesSchema = Object; // flowlint-line unclear-type: off
type ConfigSchema = { rules: RulesSchema  };

class Config {
  _root: string;
  _path: string;
  _config: ConfigSchema;
  _rules: RulesSchema;

  constructor(root: string, path: string) {
    this._root = root;
    this._path = path;

    this._config = this.loadFile();
    this._rules = this._config.rules || {};
  }

  file() {
    return path.resolve(this._root, this._path);
  }

  loadFile(): ConfigSchema {
    const file = this.file();
    switch (path.extname(file)) {
      case '.js':
        // $FlowExpectedError: dynamic require!
        return require(file);
      case '.json':
        // if (path.basename(file) === "package.json") {
        //   return loadPackageJSONConfigFile(filePath);
        // }
        // return loadJSONConfigFile(filePath);
        console.error(`Parsing package.json, *.json and *.json5 files is unsupported. Found ${file}`);
        return {};
      case '.yml':
      case '.yaml':
        // yaml versions, unsupported, need parser
        console.error(`Yaml files are unsupported. Found: ${file}`);
        return {};
      default:
        // legacy version, unsupported, need to read spec
        console.error(`Legacy files are unsupported. Found: ${file}`);
        return {};
    }
    // console.log('reading', file)
    // this._config = fs.readFileSync(file, 'utf8');
  }
}

function getChainFor(branches, file): Array<Config> {
  const parts = file.split('/');

  let node = branches;

  const chain = [];
  parts.forEach((part) => {
    node = node[part];
    if (node['.eslintrc.js']) {
      chain.push(node['.eslintrc.js']);
    }
    if (node['.eslintrc.json']) {
      chain.push(node['.eslintrc.json']);
    }
  });
  return chain;
}

function flatten(chain: Array<Config>) {
  const effective = {};
  const status = {}; // inherit, override, unique

  const rules = chain.reduce((combined, config) => {
    Object.entries(config._rules).forEach(([key, value]) => {
      const val = JSON.stringify(value);
      if (key in effective) {
        if (effective[key] === val) {
          status[key] = 'inherit';
        } else {
          status[key] = 'override';
        }
      } else {
        status[key] = 'unique';
      }
      effective[key] = val;
    });
    return {
      _rules: {...combined._rules, ...config._rules},
    }
  }, {_rules: {}});

  const result = {};
  Object.entries(status).forEach(([key, stat]) => {
    if (stat !== 'inherit') {
      result[key] = rules._rules[key];
    }
  });

  return result;
}

export function getTree(root: string): Tree {
  console.log('getting eslintrc files in', root)
  const files = glob.sync("**/.eslintrc.*", {
    cwd: root,
    nodir: true,
  });

  const branches = {};

  files.forEach((file) => {
    let branch = branches;
    const parts = file.split('/');
    parts.forEach((folder) => {
      if (folder.startsWith('.eslint')) {
        branch[folder] = new Config(root, file);
      } else {
        branch[folder] = branch[folder] || {};
        branch = branch[folder];
      }
    })
  });

  const chains = {};
  const configs = {};
  files.forEach((file) => {
    chains[file] = getChainFor(branches, file);
    configs[file] = flatten(chains[file]);

  });

  return {
    files: files,
    branches: branches,
    chains: chains,
    configs: configs,
  };
}
export function printTree(tree: Tree): void {
  // console.log(tree.files);
  const replacer = (key, value) => {
    const blacklist = [
      '_config',
    ];
    if (blacklist.includes(key)) {
      return undefined;
    } else {
      return value;
    }
  };
  // console.log(JSON.stringify(tree.branches, replacer, '\t'));
  // console.log(tree.chains);
  console.log(JSON.stringify(tree.configs, replacer, '\t'));
}
