import { useMediaQuery } from './useMediaQuery'

/**
 * Four layout tiers used across GreenCare Admin:
 * - mobile:  phones          < 768px
 * - tablet:  tablets         768px – 1023px
 * - laptop:  laptops         1024px – 1279px
 * - desktop: large desktops  ≥ 1280px
 */
export type Breakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop'

export function useBreakpoint(): Breakpoint {
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const isLaptop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 768px)')

  if (isDesktop) return 'desktop'
  if (isLaptop) return 'laptop'
  if (isTablet) return 'tablet'
  return 'mobile'
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
