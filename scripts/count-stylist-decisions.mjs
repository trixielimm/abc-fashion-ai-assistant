// Static source audit, not a measurement of decisions executed per message.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const scope = [
  ['lib/stylist/conversationTurn.ts', 'shortcutPlan', 'Recognise supported requests and choose a plan'],
  ['lib/stylist/conversationGrounding.ts', 'groundConversationPlan', 'Ground intent, references and literal constraints'],
  ['lib/stylist/conversationPlan.ts', 'checkConversationPlan', 'Validate intent, evidence and state changes'],
  ['lib/stylist/preferenceScope.ts', 'composePreferences', 'Reconcile item and shared restrictions'],
  ['lib/stylist/productReference.ts', 'resolveProductReference', 'Resolve which product the customer means'],
  ['lib/stylist/taskState.ts', 'prepareConversationTask', 'Prepare context, task changes and recovery'],
];
let baseCommit = null;
try {
  baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch { /* Source archives need not have Git metadata. */ }

const functions = scope.map(([file, name, purpose]) => {
  const path = new URL(file, root);
  const contents = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length, 0, `${file}: source must parse`);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn?.body, `Missing function body: ${name}`);
  const counts = { if_statements: 0, ternary_expressions: 0 };
  function visit(node) {
    if (ts.isIfStatement(node)) counts.if_statements++;
    if (ts.isConditionalExpression(node)) counts.ternary_expressions++;
    ts.forEachChild(node, visit);
  }
  visit(fn.body);
  return {
    file, absolute_path: fileURLToPath(path), function: name, purpose,
    start_line: source.getLineAndCharacterOfPosition(fn.getStart(source)).line + 1,
    end_line: source.getLineAndCharacterOfPosition(fn.end).line + 1,
    source_sha256: createHash('sha256').update(contents).digest('hex'), ...counts,
  };
});
const totals = functions.reduce((sum, row) => ({
  if_statements: sum.if_statements + row.if_statements,
  ternary_expressions: sum.ternary_expressions + row.ternary_expressions,
}), { if_statements: 0, ternary_expressions: 0 });
console.log(JSON.stringify({
  method_version: 1, source_snapshot: 'current working tree; includes any local edits',
  base_commit: baseCommit, typescript_version: ts.version,
  scope: 'Six core request-understanding and validation functions, including their nested helper bodies.',
  method: 'Count each TypeScript AST IfStatement once. Count ConditionalExpression nodes separately. Repeated calls and loop iterations do not multiply a source location.',
  exclusions: 'No prompt text, comments, tests, schema fields, boolean subexpressions, loop-control conditions, implicit else outcomes, model-internal reasoning, product retrieval, response formatting, transport or UI functions are added to the tally.',
  interpretation: 'Static conditional-code sites, not independent business rules, separate decision trees, AI calls, or decisions executed for every message. This narrow scope is not a whole-system total.',
  functions, totals,
  combined_conditional_sites: totals.if_statements + totals.ternary_expressions,
}, null, 2));
