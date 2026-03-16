import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSessionCount,
  incrementSessionCount,
  shouldShowSwipeHint,
} from '../session-counter';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('session-counter', () => {
  describe('getSessionCount', () => {
    it('returns 0 when no count stored', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await getSessionCount()).toBe(0);
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        '@ogs/session_count'
      );
    });

    it('returns parsed count from storage', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('3');
      expect(await getSessionCount()).toBe(3);
    });
  });

  describe('incrementSessionCount', () => {
    it('increments from 0 to 1', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      const result = await incrementSessionCount();
      expect(result).toBe(1);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@ogs/session_count',
        '1'
      );
    });

    it('increments existing count', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('4');
      const result = await incrementSessionCount();
      expect(result).toBe(5);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@ogs/session_count',
        '5'
      );
    });
  });

  describe('shouldShowSwipeHint', () => {
    it('returns true for session 0 (first launch)', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await shouldShowSwipeHint()).toBe(true);
    });

    it('returns true for session 4 (last hint session)', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('4');
      expect(await shouldShowSwipeHint()).toBe(true);
    });

    it('returns false for session 5 (threshold reached)', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('5');
      expect(await shouldShowSwipeHint()).toBe(false);
    });

    it('returns false for session 10 (well past threshold)', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('10');
      expect(await shouldShowSwipeHint()).toBe(false);
    });
  });
});
