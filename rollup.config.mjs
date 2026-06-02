import terser from '@rollup/plugin-terser';

export default [
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.mjs',
      format: 'esm',
      sourcemap: false
    }
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      exports: 'default',
      sourcemap: false
    }
  },
  {
    input: 'src/browser.js',
    output: {
      file: 'dist/widget.js',
      format: 'iife',
      name: 'WidgetSDK',
      sourcemap: false
    }
  },
  {
    input: 'src/browser.js',
    output: {
      file: 'dist/widget.min.js',
      format: 'iife',
      name: 'WidgetSDK',
      sourcemap: false
    },
    plugins: [terser()]
  }
];
