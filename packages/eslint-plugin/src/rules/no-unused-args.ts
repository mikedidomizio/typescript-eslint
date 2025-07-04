import type { TSESTree } from '@typescript-eslint/utils';

import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRule } from '../util';

const usedIdentifiers = new Map<
  string,
  {
    args: string[];
    used: string[];
  }
>();

export default createRule({
  name: 'no-unused-args',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce all arguments of a function are used at least once',
    },
    messages: {
      argsNotUsed:
        'All arguments of the function `{{ fn }}` should be used at least once. Not used: {{ unusedArgs }}.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const tmpDir = fs.mkdtempSync(os.tmpdir());
    const CACHE_PATH = path.join(tmpDir, 'usage.json');

    function checkFunctionDeclaration(
      node: TSESTree.FunctionDeclaration,
    ): void {
      const filename = context.filename;

      const name = node.id?.name;

      if (!name) {
        return;
      }

      const args = node.params
        .filter(parameter => parameter.type === AST_NODE_TYPES.Identifier)
        .map(p => {
          // todo this isn't going to work for properties that are not objects or primitives
          // perhaps primitives should also return the property
          return p.name;
        });

      const key = `${filename}#${name}`;

      usedIdentifiers.set(key, {
        args,
        used: [],
      });
    }

    function checkCallExpression(
      node: TSESTree.CallExpression | TSESTree.NewExpression,
    ): void {
      const filename = context.filename;

      // todo I'm not 100% sure that Identifier is what I want but it helps for type guards
      if (
        node.arguments.length > 0 &&
        node.callee.type === AST_NODE_TYPES.Identifier
      ) {
        const key = `${filename}#${node.callee.name}`;
        const func = usedIdentifiers.get(key);

        if (func) {
          const usedArgs = func.args.slice(0, node.arguments.length);

          // union of the two arrays
          const newUsed = [...new Set([...func.used, ...usedArgs])];

          usedIdentifiers.set(key, {
            args: func.args,
            used: newUsed,
          });
        } else {
          throw new Error(
            `Could not find function declaration for call expression: ${key}`,
          );
        }
      }
    }

    return {
      CallExpression: checkCallExpression,
      FunctionDeclaration: checkFunctionDeclaration,
      'Program:exit'(): void {
        const newCache = JSON.stringify([...usedIdentifiers], null, 2);

        fs.writeFileSync(CACHE_PATH, newCache);

        for (const [funcKey, vals] of usedIdentifiers.entries()) {
          if (vals.args.length > vals.used.length) {
            const unused = vals.args.slice(vals.used.length);

            context.report({
              loc: { column: 0, line: 1 },
              messageId: 'argsNotUsed',
              data: {
                fn: funcKey,
                unusedArgs: unused.join(', '),
              },
            });
          }
        }
      },
    };
  },
});
