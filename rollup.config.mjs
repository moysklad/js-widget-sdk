import terser from '@rollup/plugin-terser';

const input = 'src/index.js';

export default [
  {
    input,
    output: {
      file: 'dist/widget.js',
      format: 'iife',
      name: 'WidgetSDK',
      sourcemap: false
    }
  },
  {
    input,
    output: {
      file: 'dist/widget.min.js',
      format: 'iife',
      name: 'WidgetSDK',
      sourcemap: false
    },
    plugins: [
      terser()
    ]
  }
];
