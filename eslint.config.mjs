import nextPlugin from 'eslint-config-next';

const config = [
  ...nextPlugin,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
