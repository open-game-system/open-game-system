import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecentDevUrls, addRecentDevUrl } from '../dev-urls';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dev-urls', () => {
  describe('getRecentDevUrls', () => {
    it('returns empty array when no URLs stored', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await getRecentDevUrls()).toEqual([]);
    });

    it('returns parsed URLs from storage', async () => {
      const urls = ['https://localhost:3000', 'https://test.dev'];
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(urls));
      expect(await getRecentDevUrls()).toEqual(urls);
    });
  });

  describe('addRecentDevUrl', () => {
    it('adds URL to the front of the list', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(['https://old.dev'])
      );
      await addRecentDevUrl('https://new.dev');
      const stored = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored[0]).toBe('https://new.dev');
      expect(stored[1]).toBe('https://old.dev');
    });

    it('deduplicates existing URLs by moving to front', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(['https://a.dev', 'https://b.dev', 'https://c.dev'])
      );
      await addRecentDevUrl('https://b.dev');
      const stored = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored).toEqual([
        'https://b.dev',
        'https://a.dev',
        'https://c.dev',
      ]);
    });

    it('limits to 10 URLs', async () => {
      const tenUrls = Array.from(
        { length: 10 },
        (_, i) => `https://url${i}.dev`
      );
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(tenUrls));
      await addRecentDevUrl('https://new.dev');
      const stored = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored).toHaveLength(10);
      expect(stored[0]).toBe('https://new.dev');
      expect(stored[9]).toBe('https://url8.dev'); // url9 evicted
    });

    it('adds to empty list and uses correct storage key', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      await addRecentDevUrl('https://first.dev');
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        '@ogs/recent_dev_urls'
      );
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@ogs/recent_dev_urls',
        expect.any(String)
      );
      const stored = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored).toEqual(['https://first.dev']);
    });
  });
});
