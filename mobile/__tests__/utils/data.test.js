import { toList, toObject } from '../../src/utils/data';

describe('toList()', () => {
  it('returns an array as-is', () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(toList(items)).toEqual(items);
  });

  it('returns empty array for null/undefined', () => {
    expect(toList(null)).toEqual([]);
    expect(toList(undefined)).toEqual([]);
  });

  it('returns empty array for a non-object primitive', () => {
    expect(toList('hello')).toEqual([]);
    expect(toList(42)).toEqual([]);
  });

  it('extracts results from paginated DRF shape', () => {
    const payload = { count: 2, results: [{ id: 1 }, { id: 2 }] };
    expect(toList(payload)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('extracts data array from wrapped response', () => {
    const payload = { data: [{ id: 1 }] };
    expect(toList(payload)).toEqual([{ id: 1 }]);
  });

  it('extracts categories array from wrapped response', () => {
    const payload = { categories: [{ id: 1 }, { id: 2 }] };
    expect(toList(payload)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('extracts items array from wrapped response', () => {
    const payload = { items: [{ id: 3 }] };
    expect(toList(payload)).toEqual([{ id: 3 }]);
  });

  it('returns empty array for plain object with no known key', () => {
    const payload = { name: 'test', total: 100 };
    expect(toList(payload)).toEqual([]);
  });
});

describe('toObject()', () => {
  it('extracts data object from wrapped response', () => {
    const payload = { data: { id: 1, name: 'Table 1' } };
    expect(toObject(payload)).toEqual({ id: 1, name: 'Table 1' });
  });

  it('returns the payload itself if no .data wrapper', () => {
    const payload = { id: 1, name: 'Test' };
    expect(toObject(payload)).toEqual(payload);
  });

  it('returns empty object for null/undefined', () => {
    expect(toObject(null)).toEqual({});
    expect(toObject(undefined)).toEqual({});
  });

  it('does not unwrap if data is an array', () => {
    const payload = { data: [1, 2, 3] };
    expect(toObject(payload)).toEqual({ data: [1, 2, 3] });
  });
});
