import {

  Cloud,

  CloudRain,

  Snowflake,

  Sun,

  Wind,

  type LucideIcon,

} from 'lucide-react'

import {

  WEATHER_OPTIONS,

  type WeatherIconKey,

} from '../../constants/dailyPlan'

import { useLanguageStore } from '../../stores/languageStore'



type Props = {

  value: string

  onChange: (weather: string) => void

}



const WEATHER_ICONS: Record<WeatherIconKey, LucideIcon> = {

  sun: Sun,

  cloud: Cloud,

  rain: CloudRain,

  snow: Snowflake,

  wind: Wind,

}



const NAVY = '#121820'



export function WeatherOptionChips({ value, onChange }: Props) {

  const { t } = useLanguageStore()



  return (

    <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:overflow-x-auto">

      {WEATHER_OPTIONS.map((option) => {

        const active = value === option.value

        const Icon = WEATHER_ICONS[option.icon]

        return (

          <button

            key={option.value}

            type="button"

            onClick={() => onChange(option.value)}

            className={`inline-flex h-10 min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 transition-colors duration-150 sm:flex-none ${

              active

                ? 'border-[#121820]/25 bg-[#f4f5f7]'

                : 'border-slate-200 bg-white hover:bg-[#f4f5f7]'

            }`}

          >

            <span

              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"

              style={{

                background: active ? NAVY : '#eef0f2',

              }}

            >

              <Icon

                size={14}

                strokeWidth={1.75}

                color={active ? '#ffffff' : NAVY}

              />

            </span>

            <span

              className={`pr-0.5 text-[12px] tracking-[-0.01em] ${

                active

                  ? 'font-medium text-[#121820]'

                  : 'font-normal text-slate-600'

              }`}

            >

              {t(option.labelKey)}

            </span>

          </button>

        )

      })}

    </div>

  )

}

