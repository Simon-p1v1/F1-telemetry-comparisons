export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  'Mercedes': '#27F4D2',
  'Ferrari': '#E8002D',
  'McLaren': '#FF8000',
  'Aston Martin': '#229971',
  'Alpine': '#0093CC',
  'Alpine F1 Team': '#0093CC',
  'Williams': '#64C4FF',
  'Williams Racing': '#64C4FF',
  'AlphaTauri': '#5E8FAA',
  'RB': '#6692FF',
  'Racing Bulls': '#6692FF',
  'Visa Cash App RB F1 Team': '#6692FF',
  'Visa Cash App RB': '#6692FF',
  'Alfa Romeo': '#C92D4B',
  'Kick Sauber': '#52E252',
  'Sauber': '#52E252',
  'Audi': '#A2A2A2',
  'Haas F1 Team': '#B6BABD',
  'Haas': '#B6BABD',
}

// Bright distinct colors for driver chart lines
export const DRIVER_PALETTE = [
  '#e10600', // F1 red
  '#00d2be', // teal
  '#ff8700', // orange
  '#1e6fff', // blue
  '#39b54a', // green
  '#ffcc00', // yellow
  '#ff66cc', // pink
  '#cc44ff', // purple
  '#00aaff', // light blue
  '#ff4400', // orange-red
]

export function getTeamColor(teamName: string): string {
  return TEAM_COLORS[teamName] ?? '#666666'
}

// Heatmap color scale: blue → cyan → green → yellow → red
export function heatmapColor(t: number): string {
  const clipped = Math.max(0, Math.min(1, t))
  const stops: [number, number, number][] = [
    [0, 0, 255],    // blue
    [0, 200, 255],  // cyan
    [0, 255, 100],  // green
    [255, 255, 0],  // yellow
    [255, 50, 0],   // red
  ]
  const segment = clipped * (stops.length - 1)
  const idx = Math.min(Math.floor(segment), stops.length - 2)
  const frac = segment - idx
  const c1 = stops[idx]
  const c2 = stops[idx + 1]
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * frac)
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * frac)
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * frac)
  return `rgb(${r},${g},${b})`
}
