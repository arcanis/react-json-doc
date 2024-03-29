import ts from '@rollup/plugin-typescript';

// eslint-disable-next-line arca/no-default-export
export default {
  input: `./sources/index.tsx`,
  output: [
    {
      dir: `lib`,
      entryFileNames: `[name].mjs`,
      format: `es`,
    },
    {
      dir: `lib`,
      entryFileNames: `[name].js`,
      format: `cjs`,
    },
  ],
  preserveModules: true,
  plugins: [
    ts({
      tsconfig: `tsconfig.dist.json`,
    }),
  ],
};
