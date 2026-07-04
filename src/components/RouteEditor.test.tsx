import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from '../services/geocoding';
import { parseRoute } from '../services/urlParser';
import type * as UrlParser from '../services/urlParser';
import RouteEditor from './RouteEditor';

vi.mock('../services/geocoding', () => ({
  reverseGeocode: vi.fn(),
}));

vi.mock('../services/urlParser', async () => {
  const actual = await vi.importActual<typeof UrlParser>('../services/urlParser');

  return {
    ...actual,
    parseRoute: vi.fn(),
  };
});

const mockParseRoute = vi.mocked(parseRoute);
const mockReverseGeocode = vi.mocked(reverseGeocode);

describe('RouteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseRoute.mockResolvedValue([
      {
        city: 'Beijing',
        originalName: '北京',
        date: '2026-05-23',
      },
    ]);
    mockReverseGeocode.mockResolvedValue('Tokyo');
  });

  it('loads current route entries when opened and closes through cancel', async () => {
    render(<RouteEditor />);

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));

    expect(await screen.findByText('设置城市与路线')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Beijing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('北京')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-05-23')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('设置城市与路线')).not.toBeInTheDocument();
  });

  it('adds a same-date comparison city using the last city as default', async () => {
    render(<RouteEditor />);

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));
    await screen.findByDisplayValue('Beijing');

    fireEvent.click(screen.getByRole('button', { name: /添加同日对比城市/ }));

    const locationInputs = screen.getAllByPlaceholderText(
      '城市 或 纬度,经度',
    ) as HTMLInputElement[];
    expect(locationInputs).toHaveLength(2);
    expect(locationInputs.map((input) => input.value)).toEqual(['Beijing', 'Beijing']);
  });

  it('reverse-geocodes coordinate input and fills the alias when it is still empty', async () => {
    render(<RouteEditor />);

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));
    const locationInput = await screen.findByDisplayValue('Beijing');
    const aliasInput = screen.getByDisplayValue('北京');

    fireEvent.change(aliasInput, { target: { value: '' } });
    fireEvent.change(locationInput, { target: { value: '35.68,139.69' } });

    await waitFor(() => {
      expect(mockReverseGeocode).toHaveBeenCalledWith(35.68, 139.69, '35.68°, 139.69°');
      expect(screen.getByDisplayValue('Tokyo')).toBeInTheDocument();
    });
  });
});
