import { promises as fs } from 'fs';
import path from 'path';

const esbuildMainPath = path.resolve('node_modules/esbuild/lib/main.js');
const source = await fs.readFile(esbuildMainPath, 'utf8');

if (source.includes('transpileWithTypescript')) {
  process.exit(0);
}

let patched = source.replace(
  'var tty = require("tty");',
  'var tty = require("tty");\nvar typescript = require("typescript");'
);

const originalBlock = [
  'var build = (options) => ensureServiceIsRunning().build(options);',
  'var context = (buildOptions) => ensureServiceIsRunning().context(buildOptions);',
  'var transform = (input, options) => ensureServiceIsRunning().transform(input, options);',
  'var formatMessages = (messages, options) => ensureServiceIsRunning().formatMessages(messages, options);',
  'var analyzeMetafile = (messages, options) => ensureServiceIsRunning().analyzeMetafile(messages, options);',
].join('\n');

const patchedBlock = [
  'var build = (options) => ensureServiceIsRunning().build(options);',
  'var context = (buildOptions) => ensureServiceIsRunning().context(buildOptions);',
  'var transpileWithTypescript = (input, options = {}) => {',
  '  const compilerOptions = {',
  '    target: typescript.ScriptTarget.ES2020,',
  '    module: typescript.ModuleKind.ESNext,',
  '    jsx: typescript.JsxEmit.ReactJSX,',
  '    sourceMap: Boolean(options.sourcemap),',
  '    inlineSourceMap: false,',
  '    inlineSources: false,',
  '    importsNotUsedAsValues: typescript.ImportsNotUsedAsValues.Remove,',
  '    verbatimModuleSyntax: true,',
  '    esModuleInterop: true,',
  '  };',
  '  const result = typescript.transpileModule(input, {',
  '    compilerOptions,',
  '    fileName: options.sourcefile || "input.tsx",',
  '    reportDiagnostics: false,',
  '  });',
  '  return {',
  '    code: result.outputText,',
  '    map: result.sourceMapText || "",',
  '    warnings: [],',
  '  };',
  '};',
  'var transform = async (input, options) => transpileWithTypescript(input, options);',
  'var transformSync = (input, options) => transpileWithTypescript(input, options);',
  'var formatMessages = (messages, options) => ensureServiceIsRunning().formatMessages(messages, options);',
  'var analyzeMetafile = (messages, options) => ensureServiceIsRunning().analyzeMetafile(messages, options);',
].join('\n');

if (!patched.includes(originalBlock)) {
  throw new Error('Could not find the expected esbuild transform block to patch.');
}

patched = patched.replace(originalBlock, patchedBlock);

await fs.writeFile(esbuildMainPath, patched);
