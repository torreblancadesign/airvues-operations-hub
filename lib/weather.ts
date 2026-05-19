// Weather + location helper. Uses Vercel's edge geo headers to find the user
// without asking permission, then queries Open-Meteo (free, no API key).
import "server-only";

import { headers } from "next/headers";

export type WeatherSnapshot = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  temperatureF: number | null;
  conditionLabel: string | null;
  conditionEmoji: string | null;
  isFallback: boolean;
};

// WMO weather codes → human label + a single character emoji.
// https://open-meteo.com/en/docs#weathervariables
const WMO: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear", emoji: "☀" },
  1: { label: "Mostly clear", emoji: "🌤" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁" },
  45: { label: "Fog", emoji: "🌫" },
  48: { label: "Rime fog", emoji: "🌫" },
  51: { label: "Light drizzle", emoji: "🌦" },
  53: { label: "Drizzle", emoji: "🌦" },
  55: { label: "Heavy drizzle", emoji: "🌧" },
  61: { label: "Light rain", emoji: "🌧" },
  63: { label: "Rain", emoji: "🌧" },
  65: { label: "Heavy rain", emoji: "🌧" },
  71: { label: "Light snow", emoji: "🌨" },
  73: { label: "Snow", emoji: "❄" },
  75: { label: "Heavy snow", emoji: "❄" },
  77: { label: "Snow grains", emoji: "❄" },
  80: { label: "Rain showers", emoji: "🌧" },
  81: { label: "Heavy showers", emoji: "🌧" },
  82: { label: "Violent showers", emoji: "🌧" },
  85: { label: "Snow showers", emoji: "🌨" },
  86: { label: "Heavy snow showers", emoji: "🌨" },
  95: { label: "Thunderstorm", emoji: "⛈" },
  96: { label: "Thunder + hail", emoji: "⛈" },
  99: { label: "Heavy thunder", emoji: "⛈" },
};

// Sherman Oaks, CA — Lee's default + a sane fallback for local dev / missing geo.
const FALLBACK = {
  lat: 34.151,
  lon: -118.449,
  city: "Sherman Oaks",
  region: "CA",
  country: "US",
  timezone: "America/Los_Angeles",
};

async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; code: number } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
    const resp = await fetch(url, { next: { revalidate: 600 } }); // 10 min cache
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.current) return null;
    return {
      temp: data.current.temperature_2m,
      code: data.current.weather_code,
    };
  } catch {
    return null;
  }
}

export async function getWeatherSnapshot(): Promise<WeatherSnapshot> {
  const h = await headers();

  const latRaw = h.get("x-vercel-ip-latitude");
  const lonRaw = h.get("x-vercel-ip-longitude");
  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const country = h.get("x-vercel-ip-country");
  const timezone = h.get("x-vercel-ip-timezone");

  const lat = latRaw ? parseFloat(latRaw) : FALLBACK.lat;
  const lon = lonRaw ? parseFloat(lonRaw) : FALLBACK.lon;
  const isFallback = !latRaw || !lonRaw;

  const weather = await fetchWeather(lat, lon);

  const wmo = weather ? WMO[weather.code] : null;

  return {
    city: city ? decodeURIComponent(city) : isFallback ? FALLBACK.city : null,
    region: region ?? (isFallback ? FALLBACK.region : null),
    country: country ?? (isFallback ? FALLBACK.country : null),
    timezone: timezone ?? (isFallback ? FALLBACK.timezone : null),
    temperatureF: weather ? Math.round(weather.temp) : null,
    conditionLabel: wmo?.label ?? null,
    conditionEmoji: wmo?.emoji ?? null,
    isFallback,
  };
}
