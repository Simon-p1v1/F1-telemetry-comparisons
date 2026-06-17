export interface Event {
  RoundNumber: number
  Country: string
  Location: string
  OfficialEventName: string
  EventName: string
  EventDate: string | null
  Session1: string
  Session1Date: string | null
  Session2: string
  Session2Date: string | null
  Session3: string
  Session3Date: string | null
  Session4: string
  Session4Date: string | null
  Session5: string
  Session5Date: string | null
}

export interface Result {
  Position: number | null
  ClassifiedPosition: string | number | null
  DriverNumber: number
  BroadcastName: string
  Abbreviation: string
  DriverId: string
  TeamName: string
  GridPosition: number | null
  Status: string
  Points: number
  Time: number | null
  dnf: boolean
}

export interface Lap {
  Driver: string
  Team: string
  LapNumber: number
  Position: number | null
  LapTime: number | null
  Sector1Time: number | null
  Sector2Time: number | null
  Sector3Time: number | null
  Compound: string | null
  TyreLife: number | null
  Stint: number | null
  PitInTime: number | null
  PitOutTime: number | null
  IsAccurate: boolean | null
}

export interface TelemetryPoint {
  Date: string | null
  Time: string | null
  SessionTime: number | null
  Distance: number | null
  RPM: number | null
  Speed: number | null
  nGear: number | null
  Throttle: number | null
  Brake: number | null
  DRS: number | null
  X: number | null
  Y: number | null
}

export interface WeatherData {
  Time: number | null
  AirTemp: number | null
  Humidity: number | null
  Pressure: number | null
  Rainfall: number | null
  TrackTemp: number | null
  WindDirection: number | null
  WindSpeed: number | null
}

export interface Corner {
  Number: number
  Letter: string
  Distance: number
}

export interface TrackStatus {
  Time: number | null
  Status: string
  Message: string
}

export type MetricKey = 'Speed' | 'Throttle' | 'Brake' | 'nGear' | 'RPM' | 'DRS'
