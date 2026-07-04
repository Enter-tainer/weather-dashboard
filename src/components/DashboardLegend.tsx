import type { DashboardScales } from '../types/weather';

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

interface TemperatureCurveLegendProps {
  tempSteps: number[];
  minTemp: number;
  maxTemp: number;
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

function TemperatureCurveLegend({ tempSteps, minTemp, maxTemp }: TemperatureCurveLegendProps) {
  const H = 56;
  return (
    <div className="legend-cell" style={{ height: `${H}px`, position: 'relative' }}>
      {tempSteps.map((t) => {
        const y = H - ((t - minTemp) / (maxTemp - minTemp)) * H;
        if (y >= 12 && y <= H - 4) {
          return (
            <span
              key={t}
              style={{
                position: 'absolute',
                right: '4px',
                top: `${y - 6}px`,
                fontSize: '9px',
                color: 'var(--text-subtle)',
              }}
            >
              {t}°
            </span>
          );
        }
        return null;
      })}
    </div>
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
        <span
          style={{
            position: 'absolute',
            top: '5px',
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-light)',
          }}
        >
          总云
          <span style={{ fontSize: '9px', color: 'var(--text-subtle)', marginLeft: '2px' }}>%</span>
        </span>
        <span
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            fontSize: '9px',
            color: 'var(--text-faint)',
          }}
        >
          100
        </span>
        <span
          style={{
            position: 'absolute',
            top: '20px',
            right: '2px',
            fontSize: '9px',
            color: 'var(--text-faint)',
          }}
        >
          50
        </span>
        <span
          style={{
            position: 'absolute',
            top: '38px',
            right: '2px',
            fontSize: '9px',
            color: 'var(--text-faint)',
          }}
        >
          0
        </span>
      </div>

      <div
        className="legend-cell"
        style={{ height: 'var(--lane-height-clouds)', position: 'relative' }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-light)',
          }}
        >
          云
          <span style={{ fontSize: '8px', color: 'var(--text-subtle)', marginLeft: '2px' }}>m</span>
        </span>
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          10k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '19px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          8k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '44px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          6k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '57px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          5k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '69px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          4k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '94px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          2k
        </span>
        <span
          style={{
            position: 'absolute',
            top: '119px',
            right: '2px',
            fontSize: '8px',
            color: 'var(--text-faint)',
          }}
        >
          1k
        </span>
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            width: '100%',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--precip-prob-80)',
          }}
        >
          降水<span style={{ fontSize: '8px', opacity: 0.7, marginLeft: '1px' }}>mm</span>
        </div>
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
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: '10px',
        color: 'var(--text-light)',
      }}
    >
      {compactMode ? (
        <>
          <div>降水</div>
          <div style={{ fontSize: '8px', color: 'var(--text-subtle)' }}>mm / %</div>
        </>
      ) : (
        <div>
          降水概率
          <span style={{ fontSize: '8px', color: 'var(--text-subtle)', marginLeft: '2px' }}>%</span>
        </div>
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
        <>
          <div>风力</div>
          <div style={{ fontSize: '8px', color: 'var(--text-subtle)' }}>bft</div>
        </>
      ) : (
        <>
          <span
            style={{
              position: 'absolute',
              top: '5px',
              left: 0,
              width: '100%',
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-light)',
            }}
          >
            风速
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: '5px',
              left: 0,
              width: '100%',
              textAlign: 'center',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            bft
          </span>

          <span
            style={{
              position: 'absolute',
              top: '1px',
              right: '2px',
              fontSize: '9px',
              color: 'var(--text-faint)',
            }}
          >
            {maxBft}
          </span>
          <span
            style={{
              position: 'absolute',
              top: '25px',
              right: '2px',
              fontSize: '9px',
              color: 'var(--text-faint)',
            }}
          >
            {Math.round(maxBft / 2)}
          </span>
          <span
            style={{
              position: 'absolute',
              top: '45px',
              right: '2px',
              fontSize: '9px',
              color: 'var(--text-faint)',
            }}
          >
            0
          </span>
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
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-light)',
        }}
      >
        气压
        <span style={{ fontSize: '8px', color: 'var(--text-subtle)', marginLeft: '2px' }}>hPa</span>
      </span>
      <span
        style={{
          position: 'absolute',
          top: '16px',
          right: '4px',
          fontSize: '9px',
          color: 'var(--text-faint)',
        }}
      >
        {maxP}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: '2px',
          right: '4px',
          fontSize: '9px',
          color: 'var(--text-faint)',
        }}
      >
        {minP}
      </span>
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
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '11px',
          color: 'var(--text-light)',
        }}
      >
        <div>星期</div>
        <div style={{ marginTop: '2px' }}>小时</div>
      </div>
      <div
        className="legend-cell"
        style={{ height: '12px', fontSize: '9px', color: 'var(--text-subtle)' }}
      >
        曙暮
      </div>
      <div
        className="legend-cell"
        style={{ height: '28px', fontSize: '11px', color: 'var(--text-light)' }}
      >
        天气
      </div>
      <div
        className="legend-cell"
        style={{
          height: 'var(--lane-height-uv)',
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '11px',
          color: 'var(--text-light)',
        }}
      >
        <div>
          紫外线 <span style={{ fontSize: '8px', color: 'var(--text-subtle)' }}>UV</span>
        </div>
      </div>
      {!compactMode && (
        <div
          className="legend-cell"
          style={{ height: 'var(--lane-height-thermal)', position: 'relative' }}
        >
          <span
            style={{
              position: 'absolute',
              top: '1px',
              left: 0,
              width: '100%',
              textAlign: 'center',
              fontSize: '10px',
              color: 'var(--text-light)',
            }}
          >
            温湿度
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: '1px',
              left: 0,
              width: '100%',
              textAlign: 'center',
              fontSize: '8px',
              color: 'var(--text-subtle)',
            }}
          >
            湿度%
          </span>
          {tempSteps.map((t) => {
            const H = 80;
            const PLOT = 80 - 13 - 12; // TOP_LABEL_H + BOT_LABEL_H
            const y = 13 + PLOT * (1 - (t - minTemp) / (maxTemp - minTemp));
            if (y >= 22 && y <= 68) {
              return (
                <span
                  key={t}
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: `${y - 6}px`,
                    fontSize: '9px',
                    color: 'var(--text-subtle)',
                  }}
                >
                  {t}°
                </span>
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
            flexDirection: 'column',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--text-light)',
          }}
        >
          <div>
            温度 <span style={{ fontSize: '9px', color: 'var(--text-subtle)' }}>°C</span>
          </div>
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
            flexDirection: 'column',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--text-light)',
          }}
        >
          <div>
            对流 <span style={{ fontSize: '8px', color: 'var(--text-subtle)' }}>J/kg</span>
          </div>
        </div>
      )}

      <WindLegendCell compactMode={compactMode} maxBft={maxBft} />

      {!compactMode && <PressureLegendCell minP={minP} maxP={maxP} />}

      <div
        className="legend-cell"
        style={{
          height: '30px',
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '11px',
          color: 'var(--text-light)',
        }}
      >
        <div>AQI</div>
      </div>
      <div
        className="legend-cell"
        style={{
          height: '20px',
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '10px',
          color: 'var(--text-light)',
        }}
      >
        <div>
          能见度 <span style={{ fontSize: '8px', color: 'var(--text-subtle)' }}>km</span>
        </div>
      </div>
      <div
        className="legend-cell"
        style={{
          height: '30px',
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '10px',
          color: 'var(--text-light)',
          borderBottom: 'none',
        }}
      >
        <div>AOD</div>
      </div>
    </div>
  );
}
