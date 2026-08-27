import process from 'node:process';
import { defineConfig } from 'vitepress';
import { githubIcon } from './theme/icons';

const basePath = process.env.DOCS_BASE_PATH;

const createAbsoluteUrl = (path: string) => `https://docs.secreto.info/${path.replace(/(^\/$)/g, '')}`;

export default defineConfig({
  title: 'Secreto',
  description: 'Send private and secure notes',
  base: basePath,
  lang: 'en-US',
  lastUpdated: true,
  srcDir: './src',
  outDir: './dist',
  cleanUrls: true,

  markdown: {
    theme: {
      dark: 'github-dark',
      light: 'github-light',
    },
  },

  head: [
    ['meta', { name: 'author', content: 'kvaggone' }],
    ['meta', { name: 'keywords', content: 'Secreto, notes, secure, private, encrypted, self-hosted' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],

    ['meta', { name: 'theme-color', content: '#ffffff' }],

    ['meta', { property: 'og:title', content: 'Secreto documentation' }],
    ['meta', { property: 'og:description', content: 'Send private and secure notes' }],
    ['meta', { property: 'og:image', content: createAbsoluteUrl('og-image.png') }],
    ['meta', { property: 'og:url', content: 'https://docs.secreto.info' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Secreto' }],

    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'Secreto documentation' }],
    ['meta', { name: 'twitter:description', content: 'Send private and secure notes' }],
    ['meta', { name: 'twitter:image', content: createAbsoluteUrl('og-image.png') }],
  ],

  themeConfig: {
    logo: {
      light: '/logo-light.svg',
      dark: '/logo-dark.svg',
      alt: 'Secreto',
    },

    siteTitle: 'Secreto Docs',

    nav: [
      { text: 'secreto.info', link: 'https://secreto.info' },
    ],

    sidebar: [
      {
        text: 'Secreto',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'How it works?', link: '/how-it-works' },
        ],
      },
      {
        text: 'Self hosting',
        items: [
          { text: 'Using Docker', link: '/self-hosting/docker' },
          { text: 'Using Docker Compose', link: '/self-hosting/docker-compose' },
          { text: 'Deploy on other platforms', link: '/self-hosting/other-platforms' },
          { text: 'Configuration', link: '/self-hosting/configuration' },
          { text: 'Troubleshooting', link: '/self-hosting/troubleshooting' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'CLI', link: '/integrations/cli' },
          { text: 'NPM package', link: '/integrations/npm-package' },
        ],
      },
    ],

    footer: {
      copyright: 'Copyright © 2025-present Secreto',
    },

    editLink: {
      pattern: 'https://github.com/kvaggone/secreto/edit/main/packages/docs/src/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [
      { icon: { svg: githubIcon }, link: 'https://github.com/kvaggone/secreto', ariaLabel: 'GitHub' },
    ],

    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          options: {},
          searchOptions: {
            fuzzy: 0.3,
            prefix: true,
            boost: { title: 4, text: 2, titles: 1 },
          },
        },
      },
    },
  },
});
