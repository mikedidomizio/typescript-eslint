import { RuleTester } from '@typescript-eslint/rule-tester';

import rule from '../../src/rules/no-unused-args';

const ruleTester = new RuleTester();

ruleTester.run('no-unused-args', rule, {
  valid: [
    {
      code: `
function foo(a: string, b: string) {}

foo('c', 'd');
      `,
      name: 'should pass if all primitive args used',
    },
    {
      code: `
function foo(a: string, b: string) {}

foo('c', 'd');

foo('c');
      `,
      name: 'should pass if all primitive args used in at least one call',
    },
  ],
  invalid: [
    {
      code: `
function foo(a: string, b: string) {}

foo('c');
      `,
      errors: [
        {
          data: { fn: 'file.ts#foo', unusedArgs: 'b' },
          line: 1,
          messageId: 'argsNotUsed',
        },
      ],
      name: 'should fail if not all args used',
    },
  ],
});
