import { describe, expect, test } from 'vitest';
import { buildDocUrl } from './docs.models';

describe('docs models', () => {
  describe('buildDocUrl', () => {
    test('it creates a url to the documentation', () => {
      expect(
        buildDocUrl({
          path: '/test',

          baseUrl: 'https://docs.secreto.info',
        }),
      ).to.eql('https://docs.secreto.info/test');
    });

    test('it uses the default base url', () => {
      expect(buildDocUrl({ path: '/test' })).to.eql('https://docs.secreto.info/test');
    });

    test('it handles clashing slashes', () => {
      expect(
        buildDocUrl({
          path: '/test',
          baseUrl: 'https://docs.secreto.info/',
        }),
      ).to.eql('https://docs.secreto.info/test');
    });
  });
});
