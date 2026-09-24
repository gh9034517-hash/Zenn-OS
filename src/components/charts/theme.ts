// Paleta monocromática dos gráficos: identidade por luminosidade + padrão
// (tracejado), nunca por matiz. Texto sempre em tokens de texto.
export const CHART = {
  primary: '#f4f4f2',
  secondary: '#8e8e94',
  tertiary: '#4a4a50',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#6a6a70',
  surface: '#0b0b0d',
}

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
  axisLine: false,
} as const
