import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCities, type GeoCandidate } from '../services/geocoding';
import type * as Geocoding from '../services/geocoding';
import CityCombobox from './CityCombobox';

vi.mock('../services/geocoding', async () => {
  const actual = await vi.importActual<typeof Geocoding>('../services/geocoding');
  return { ...actual, searchCities: vi.fn() };
});

const mockSearchCities = vi.mocked(searchCities);

const chaoyangBeijing: GeoCandidate = {
  name: '朝阳',
  latitude: 39.92149,
  longitude: 116.48641,
  admin1: '北京',
  admin2: '北京市',
  country: '中国',
};

const chaoyangLiaoning: GeoCandidate = {
  name: '朝阳',
  latitude: 41.57676,
  longitude: 120.45118,
  admin1: '辽宁',
  admin2: '朝阳市',
  country: '中国',
};

function renderCombobox(
  overrides: Partial<ComponentProps<typeof CityCombobox>> = {},
  { focus = true }: { focus?: boolean } = {},
) {
  const onValueChange = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <CityCombobox
      label="城市"
      value="朝阳"
      onValueChange={onValueChange}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  if (focus) fireEvent.focus(screen.getByRole('combobox'));
  return { ...utils, onValueChange, onSelect };
}

describe('CityCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchCities.mockResolvedValue([chaoyangBeijing, chaoyangLiaoning]);
  });

  it('shows debounced suggestions with admin context and coordinates', async () => {
    renderCombobox();

    expect(await screen.findByText('北京')).toBeInTheDocument();
    expect(await screen.findByText('辽宁')).toBeInTheDocument();
    expect(mockSearchCities).toHaveBeenCalledWith('朝阳');
    // 只给能读懂的行政区，不再摆经纬度/人口/海拔
    expect(screen.queryByText(/\d+\.\d+, -?\d+\.\d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/m$/)).not.toBeInTheDocument();
  });

  it('applies the clicked candidate so the ambiguity is resolved once', async () => {
    const { onSelect } = renderCombobox();

    const options = await screen.findAllByRole('option');
    fireEvent.click(options[1] as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith(chaoyangLiaoning);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports arrow keys and Enter', async () => {
    const { onSelect } = renderCombobox();
    const input = screen.getByRole('combobox');

    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(chaoyangLiaoning);
  });

  it('explains that nothing matched instead of silently resolving elsewhere', async () => {
    mockSearchCities.mockResolvedValue([]);
    renderCombobox({ value: '啊啊啊' });

    expect(await screen.findByText(/没有匹配「啊啊啊」/)).toBeInTheDocument();
  });

  it('does not query the geocoder for raw coordinates', async () => {
    renderCombobox({ value: '31.23,121.47' });

    await waitFor(() => expect(mockSearchCities).not.toHaveBeenCalled());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('stays quiet for existing route entries until the field is focused', async () => {
    renderCombobox({ value: 'Beijing' }, { focus: false });

    await waitFor(() => expect(mockSearchCities).not.toHaveBeenCalled());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole('combobox'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });

  it('closes the list on Escape', async () => {
    renderCombobox();
    await screen.findAllByRole('option');

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
