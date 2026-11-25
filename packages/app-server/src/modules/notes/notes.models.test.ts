import { describe, expect, test } from 'vitest';
import { formatNoteForApi, isNoteExpired } from './notes.models';

describe('notes models', () => {
  describe('isNoteExpired', () => {
    test('a stored note is expired if the expiration date is earlier than the current date', () => {
      expect(
        isNoteExpired({
          note: { expirationDate: new Date('2024-01-01T00:00:00Z') },
          now: new Date('2024-01-02T00:00:01Z'),
        }),
      ).to.eql(true);

      expect(
        isNoteExpired({
          note: { expirationDate: new Date('2024-01-03T00:00:00Z') },
          now: new Date('2024-01-02T00:00:00Z'),
        }),
      ).to.eql(false);
    });

    test('when the expiration date is the same as the current date, the note is considered expired', () => {
      expect(
        isNoteExpired({
          note: { expirationDate: new Date('2024-01-02T00:00:00Z') },
          now: new Date('2024-01-02T00:00:00Z'),
        }),
      ).to.eql(true);
    });

    test('notes without an expiration date are not considered expired', () => {
      expect(isNoteExpired({ note: {}, now: new Date('2024-01-02T00:00:00Z') })).to.eql(false);
      expect(isNoteExpired({ note: { expirationDate: undefined }, now: new Date('2024-01-02T00:00:00Z') })).to.eql(false);
    });
  });

  describe('formatNoteForApi', () => {
    test('the flags describing how the note is stored are dropped, and the expiration date is kept for the client countdown', () => {
      const storedNote = {
        payload: '<encrypted-content>',
        expirationDate: new Date('2024-01-01T00:00:00Z'),
        deleteAfterReading: false,
        serializationFormat: 'cbor-array',
        encryptionAlgorithm: 'aes-256-gcm',
        isPublic: false,
      };

      expect(formatNoteForApi({ note: storedNote })).to.eql({
        apiNote: {
          payload: '<encrypted-content>',
          encryptionAlgorithm: 'aes-256-gcm',
          serializationFormat: 'cbor-array',
          // The view page counts down to this date, so it has to survive formatting.
          expirationDate: new Date('2024-01-01T00:00:00Z'),
        },
      });
    });

    test('a note without an expiration date is formatted without one', () => {
      const storedNote = {
        payload: '<encrypted-content>',
        deleteAfterReading: false,
        serializationFormat: 'cbor-array',
        encryptionAlgorithm: 'aes-256-gcm',
        isPublic: false,
      };

      expect(formatNoteForApi({ note: storedNote })).to.eql({
        apiNote: {
          payload: '<encrypted-content>',
          encryptionAlgorithm: 'aes-256-gcm',
          serializationFormat: 'cbor-array',
        },
      });
    });
  });
});
