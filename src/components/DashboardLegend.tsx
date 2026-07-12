import type { CSSProperties, ReactNode } from 'react';
import type { DashboardScales } from '../types/weather';
import { getHourlyPrecipBarHeight, PRECIP_INTENSITY_BANDS } from '../services/minutelyChart';
import { cloudAltitudeToY } from '../services/cloudAndRainScale';

const CLOUD_ALTITUDE_TICKS = [
  { altitude: 10_000, label: '10k' },
  { altitude: 8_000, label: '8k' },
  { altitude: 6_000, label: '6k' },
  { altitude: 5_000, label: '5k' },
  { altitude: 4_000, label: '4k' },
  { altitude: 2_000, label: '2k' },
  { altitude: 1_000, label: '1k' },
] as const;

interface GitHubLegendCellProps {
  showLink: boolean;
}

function GitHubLegendCell({ showLink }: GitHubLegendCellProps) {
  return (
    <div className="legend-cell" style={{ height: '24px', borderBottom: 'none' }}>
      {showLink && (
        <a
          href="https://github.com/Enter-tainer/weather-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-subtle)',
            opacity: 0.85,
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
        </a>
      )}
    </div>
  );
}

interface CompactModeLegendProps {
  compactMode: boolean;
}

interface WindLegendCellProps extends CompactModeLegendProps {
  maxBft: number;
}

interface PressureLegendCellProps {
  minP: number;
  maxP: number;
}

interface DashboardLegendProps {
  compactMode: boolean;
  scales: DashboardScales;
  showGitHubLink?: boolean;
}

interface LegendLabelProps {
  children: ReactNode;
  unit?: ReactNode;
  className?: string;
}

function LegendLabel({ children, unit, className = '' }: LegendLabelProps) {
  return (
    <span className={`legend-title ${className}`.trim()}>
      {children}
      {unit != null && <span className="legend-unit">{unit}</span>}
    </span>
  );
}

interface LegendAxisTickProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function LegendAxisTick({ children, className = '', style }: LegendAxisTickProps) {
  return (
    <span className={`legend-axis-tick ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}

function CloudLegendCells() {
  return (
    <>
      <div
        className="legend-cell"
        style={{
          height: '50px',
          position: 'relative',
          borderBottom: '1px solid var(--lane-border)',
        }}
      >
        <LegendLabel unit="%" className="legend-scale-title legend-title--tight">
          总云
        </LegendLabel>
        <LegendAxisTick style={{ top: '2px' }}>100</LegendAxisTick>
        <LegendAxisTick style={{ top: '20px' }}>50</LegendAxisTick>
        <LegendAxisTick style={{ top: '38px' }}>0</LegendAxisTick>
      </div>

      <div
        className="legend-cell"
        style={{ height: 'var(--lane-height-clouds)', position: 'relative' }}
      >
        <LegendLabel unit="m" className="legend-scale-title">
          云
        </LegendLabel>
        {CLOUD_ALTITUDE_TICKS.map((tick) => (
          <LegendAxisTick
            key={tick.altitude}
            className="cloud-altitude-legend-tick"
            style={{
              top: `${Math.max(-4, cloudAltitudeToY(tick.altitude) - 6)}px`,
            }}
          >
            {tick.label}
          </LegendAxisTick>
        ))}
        <LegendLabel unit="mm/h" className="legend-rain-title">
          雨强
        </LegendLabel>
        {PRECIP_INTENSITY_BANDS.map((band) => (
          <div
            key={band.label}
            className="rain-intensity-legend-row"
            aria-label={`${band.label} ${band.maxRate} mm/h`}
            style={{
              position: 'absolute',
              right: 0,
              bottom: `${getHourlyPrecipBarHeight(band.maxRate)}px`,
              left: 0,
              color: 'var(--text-faint)',
            }}
          >
            <LegendAxisTick
              className="rain-intensity-legend-label"
              style={{
                top: 0,
                paddingLeft: '2px',
                transform: 'translateY(-50%)',
                background: 'var(--legend-bg)',
                lineHeight: '10px',
              }}
            >
              {band.label} {band.maxRate}
            </LegendAxisTick>
          </div>
        ))}
      </div>
    </>
  );
}

function PrecipitationLegendCell({ compactMode }: CompactModeLegendProps) {
  return (
    <div
      className="legend-cell"
      style={{
        height: compactMode ? '42px' : 'var(--lane-height-precip-prob)',
      }}
    >
      {compactMode ? (
        <LegendLabel unit="mm/%">降水</LegendLabel>
      ) : (
        <LegendLabel unit="%" className="legend-title--tight">
          降水概率
        </LegendLabel>
      )}
    </div>
  );
}

function WindLegendCell({ compactMode, maxBft }: WindLegendCellProps) {
  return (
    <div
      className="legend-cell"
      style={{ height: compactMode ? '36px' : 'var(--lane-height-wind)', position: 'relative' }}
    >
      {compactMode ? (
        <LegendLabel unit="bft">风力</LegendLabel>
      ) : (
        <>
          <LegendLabel className="legend-scale-title">风速</LegendLabel>
          <span className="legend-secondary legend-secondary--bottom">bft</span>
          <LegendAxisTick style={{ top: '1px' }}>{maxBft}</LegendAxisTick>
          <LegendAxisTick style={{ top: '25px' }}>{Math.round(maxBft / 2)}</LegendAxisTick>
          <LegendAxisTick style={{ top: '45px' }}>0</LegendAxisTick>
        </>
      )}
    </div>
  );
}

function PressureLegendCell({ minP, maxP }: PressureLegendCellProps) {
  return (
    <div
      className="legend-cell"
      style={{ height: 'var(--lane-height-pressure)', position: 'relative' }}
    >
      <LegendLabel unit="hPa" className="legend-scale-title">
        气压
      </LegendLabel>
      <LegendAxisTick style={{ top: '16px' }}>{maxP}</LegendAxisTick>
      <LegendAxisTick style={{ bottom: '2px' }}>{minP}</LegendAxisTick>
    </div>
  );
}

export default function DashboardLegend({
  compactMode,
  scales,
  showGitHubLink = true,
}: DashboardLegendProps) {
  const { tempSteps, minTemp, maxTemp, maxBft, minP, maxP } = scales;

  return (
    <div className="legend-sidebar">
      <GitHubLegendCell showLink={showGitHubLink} />
      <div
        className="legend-cell"
        style={{
          height: 'var(--lane-height-basic)',
        }}
      >
        <LegendLabel>星期</LegendLabel>
        <span className="legend-secondary legend-secondary--stacked">小时</span>
      </div>
      <div className="legend-cell" style={{ height: '12px' }}>
        <span className="legend-secondary">曙暮</span>
      </div>
      <div className="legend-cell" style={{ height: '28px' }}>
        <LegendLabel>天气</LegendLabel>
      </div>
      <div
        className="legend-cell"
        style={{
          height: 'var(--lane-height-uv)',
        }}
      >
        <LegendLabel unit="UV">紫外线</LegendLabel>
      </div>
      {!compactMode && (
        <div
          className="legend-cell"
          style={{ height: 'var(--lane-height-thermal)', position: 'relative' }}
        >
          <LegendLabel className="legend-scale-title">温湿度</LegendLabel>
          <span className="legend-secondary legend-secondary--bottom">湿度 %</span>
          {tempSteps.map((t) => {
            const H = 80;
            const PLOT = 80 - 13 - 12; // TOP_LABEL_H + BOT_LABEL_H
            const y = 13 + PLOT * (1 - (t - minTemp) / (maxTemp - minTemp));
            if (y >= 22 && y <= 68) {
              return (
                <LegendAxisTick
                  key={t}
                  style={{
                    top: `${y - 6}px`,
                  }}
                >
                  {t}°
                </LegendAxisTick>
              );
            }
            return null;
          })}
        </div>
      )}
      {compactMode && (
        <div
          className="legend-cell"
          style={{
            height: '35px',
          }}
        >
          <LegendLabel unit="°C">温度</LegendLabel>
        </div>
      )}

      {!compactMode && (
        <>
          <CloudLegendCells />
        </>
      )}

      <PrecipitationLegendCell compactMode={compactMode} />

      {!compactMode && (
        <div
          className="legend-cell"
          style={{
            height: 'var(--lane-height-cape)',
          }}
        >
          <LegendLabel unit="J/kg">对流</LegendLabel>
        </div>
      )}

      <WindLegendCell compactMode={compactMode} maxBft={maxBft} />

      {!compactMode && <PressureLegendCell minP={minP} maxP={maxP} />}

      <div
        className="legend-cell"
        style={{
          height: '30px',
        }}
      >
        <LegendLabel>AQI</LegendLabel>
      </div>
      <div
        className="legend-cell"
        style={{
          height: '20px',
        }}
      >
        <LegendLabel unit="km">能见度</LegendLabel>
      </div>
      <div
        className="legend-cell"
        style={{
          height: '30px',
          borderBottom: 'none',
        }}
      >
        <LegendLabel>AOD</LegendLabel>
      </div>
    </div>
  );
}
