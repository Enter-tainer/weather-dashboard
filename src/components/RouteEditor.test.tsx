import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from '../services/geocoding';
import { parseRoute } from '../services/urlParser';
import type * as UrlParser from '../services/urlParser';
import { clearQWeatherCredentials, loadQWeatherCredentials } from '../services/qweatherCredentials';
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
    clearQWeatherCredentials();
    mockParseRoute.mockResolvedValue([
      {
        city: 'Beijing',
        originalName: '北京',
        date: '2026-05-23',
      },
    ]);
    mockReverseGeocode.mockResolvedValue('Tokyo');
  });

  it('saves and clears a user-provided QWeather credential', async () => {
    render(<RouteEditor />);

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));
    await screen.findByText('和风天气分钟降水 (BYOK)');

    fireEvent.change(screen.getByLabelText('专属 API Host'), {
      target: { value: 'https://user.qweatherapi.com/' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'user-api-key' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /记住在此浏览器/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存凭证' }));

    expect(await screen.findByText('已保存在此浏览器')).toBeInTheDocument();
    expect(loadQWeatherCredentials()).toEqual({
      apiKey: 'user-api-key',
      apiHost: 'user.qweatherapi.com',
      persistent: true,
    });

    fireEvent.click(screen.getByRole('button', { name: '清除凭证' }));
    expect(loadQWeatherCredentials()).toBeNull();
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

  it('exposes the E-ink, reader and immersive display settings', async () => {
    const onEinkModeChange = vi.fn();
    const onReaderLayoutChange = vi.fn();
    const onImmersiveModeChange = vi.fn();
    render(
      <RouteEditor
        einkMode={false}
        onEinkModeChange={onEinkModeChange}
        readerLayout={false}
        onReaderLayoutChange={onReaderLayoutChange}
        immersiveMode={false}
        onImmersiveModeChange={onImmersiveModeChange}
      />,
    );

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));
    const einkToggle = await screen.findByRole('checkbox', { name: /墨水屏模式/ });
    const readerToggle = screen.getByRole('checkbox', { name: /阅读布局/ });
    const immersiveToggle = screen.getByRole('checkbox', { name: /沉浸显示/ });
    fireEvent.click(einkToggle);
    fireEvent.click(readerToggle);
    fireEvent.click(immersiveToggle);

    expect(onEinkModeChange).toHaveBeenCalledWith(true);
    expect(onReaderLayoutChange).toHaveBeenCalledWith(true);
    expect(onImmersiveModeChange).toHaveBeenCalledWith(true);
  });

  it('edits and applies a reader location using route-compatible syntax', async () => {
    const onReaderLocationApply = vi.fn();
    render(
      <RouteEditor
        readerLayout
        readerLocation={{ location: 'Shanghai', displayName: '上海' }}
        onReaderLocationApply={onReaderLocationApply}
      />,
    );

    fireEvent.click(screen.getByTitle('Settings & Route Editor'));
    const locationInput = await screen.findByLabelText(/常驻地点/);
    const displayNameInput = screen.getByLabelText(/显示名称（可选）/);
    fireEvent.change(locationInput, { target: { value: '31.23,121.47' } });
    fireEvent.change(displayNameInput, { target: { value: '家' } });
    fireEvent.click(screen.getByRole('button', { name: '应用常驻地点' }));

    expect(onReaderLocationApply).toHaveBeenCalledWith({
      location: '31.23,121.47',
      displayName: '家',
    });
    expect(screen.queryByText('高级模式 (多段行程拼接)')).not.toBeInTheDocument();
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
