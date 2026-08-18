/** Open-Meteo — free, no API key, reliable global coverage by lat/lng. */

export type CourseWeather = {
  weather: string
  temperature: number
  temperatureMin: number | null
  temperatureMax: number | null
  rainfallMm: number
  rainChancePct: number
  windSpeedKmh: number
  weatherCode: number
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    precipitation?: number
  }
  daily?: {
    temperature_2m_min?: number[]
    temperature_2m_max?: number[]
    precipitation_sum?: number[]
    precipitation_probability_max?: number[]
  }
}

/** Map WMO weather codes (Open-Meteo) to our checklist values. */
export function mapWeatherCodeToLabel(
  code: number,
  windSpeedKmh: number,
): string {
  // Snow
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '눈'
  // Rain / drizzle / thunderstorm
  if (
    [
      51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
    ].includes(code)
  ) {
    return '비'
  }
  // Strong wind on otherwise clear/cloudy conditions
  if (windSpeedKmh >= 35 && [0, 1, 2, 3].includes(code)) return '바람'
  // Clear
  if (code === 0 || code === 1) return '맑음'
  // Cloudy / fog / overcast
  return '흐림'
}

export async function fetchCourseWeather(
  lat: number,
  lng: number,
): Promise<CourseWeather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,weather_code,wind_speed_10m,precipitation',
    daily:
      'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
    wind_speed_unit: 'kmh',
  })

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  )
  if (!res.ok) {
    throw new Error(`Weather request failed (${res.status})`)
  }

  const data = (await res.json()) as OpenMeteoResponse
  const current = data.current ?? {}
  const daily = data.daily

  const weatherCode = current.weather_code ?? 0
  const windSpeedKmh = current.wind_speed_10m ?? 0
  const temperature =
    current.temperature_2m ??
    daily?.temperature_2m_max?.[0] ??
    0
  const rainfallMm =
    daily?.precipitation_sum?.[0] ?? current.precipitation ?? 0
  const rainChancePct = daily?.precipitation_probability_max?.[0] ?? 0

  return {
    weather: mapWeatherCodeToLabel(weatherCode, windSpeedKmh),
    temperature: Math.round(temperature * 10) / 10,
    temperatureMin:
      daily?.temperature_2m_min?.[0] != null
        ? Math.round(daily.temperature_2m_min[0] * 10) / 10
        : null,
    temperatureMax:
      daily?.temperature_2m_max?.[0] != null
        ? Math.round(daily.temperature_2m_max[0] * 10) / 10
        : null,
    rainfallMm: Math.round(rainfallMm * 10) / 10,
    rainChancePct: Math.round(rainChancePct),
    windSpeedKmh: Math.round(windSpeedKmh * 10) / 10,
    weatherCode,
  }
}
