export type WorkStatus = 'pending' | 'approved' | 'rejected'

export type MockWorkReport = {
  id: string
  workerName: string
  workerRole: string
  course: string
  workTypes: string[]
  status: WorkStatus
  date: string
  timeAgo: string
  beforeUrl: string
  afterUrl: string
  notes?: string
  reviewer?: string
}

export type MockDisease = {
  id: string
  healthy: boolean
  diseaseNameKo?: string
  diseaseNameEn?: string
  confidence: number
  severity?: 'low' | 'moderate' | 'high' | 'critical'
  affectedPercent?: number
  date: string
  timeAgo: string
  status: 'completed' | 'approved' | 'flagged'
  photos: { url: string; angle: string }[]
  recommendationKo: string
  recommendationEn: string
}

export const mockWorkReports: MockWorkReport[] = [
  {
    id: '1',
    workerName: '김민수',
    workerRole: '작업자',
    course: '솔트베이 골프클럽',
    workTypes: ['예초', '관수'],
    status: 'pending',
    date: '2026-05-11',
    timeAgo: '2시간 전',
    beforeUrl: 'https://picsum.photos/seed/gc1/320/240',
    afterUrl: 'https://picsum.photos/seed/gc2/320/240',
    notes: '9번 홀 페어웨이 중앙 구역 점검 완료.',
  },
  {
    id: '2',
    workerName: '이지은',
    workerRole: '작업자',
    course: '오크밸리 골프클럽',
    workTypes: ['시비', '토핑'],
    status: 'approved',
    date: '2026-05-10',
    timeAgo: '1일 전',
    beforeUrl: 'https://picsum.photos/seed/gc3/320/240',
    afterUrl: 'https://picsum.photos/seed/gc4/320/240',
    reviewer: '관리자',
  },
  {
    id: '3',
    workerName: '박준호',
    workerRole: '작업자',
    course: '남서울 골프클럽',
    workTypes: ['장비'],
    status: 'rejected',
    date: '2026-05-09',
    timeAgo: '2일 전',
    beforeUrl: 'https://picsum.photos/seed/gc5/320/240',
    afterUrl: 'https://picsum.photos/seed/gc6/320/240',
  },
]

export const mockDiseases: MockDisease[] = [
  {
    id: 'd1',
    healthy: true,
    confidence: 94,
    date: '2026-05-11',
    timeAgo: '3시간 전',
    status: 'completed',
    photos: [
      { url: 'https://picsum.photos/seed/d1/400/400', angle: '상단' },
      { url: 'https://picsum.photos/seed/d2/400/400', angle: '중앙' },
      { url: 'https://picsum.photos/seed/d3/400/400', angle: '하단' },
      { url: 'https://picsum.photos/seed/d4/400/400', angle: '좌측' },
      { url: 'https://picsum.photos/seed/d5/400/400', angle: '우측' },
      { url: 'https://picsum.photos/seed/d6/400/400', angle: '클로즈업' },
    ],
    recommendationKo: '전반적으로 잔디 상태가 양호합니다. 주간 관수 일정을 유지하세요.',
    recommendationEn:
      'Overall turf condition is good. Maintain the current irrigation schedule.',
  },
  {
    id: 'd2',
    healthy: false,
    diseaseNameKo: '달러스팟',
    diseaseNameEn: 'Dollar Spot',
    confidence: 87,
    severity: 'moderate',
    affectedPercent: 12.5,
    date: '2026-05-10',
    timeAgo: '1일 전',
    status: 'completed',
    photos: [
      { url: 'https://picsum.photos/seed/e1/400/400', angle: '상단' },
      { url: 'https://picsum.photos/seed/e2/400/400', angle: '중앙' },
      { url: 'https://picsum.photos/seed/e3/400/400', angle: '하단' },
      { url: 'https://picsum.photos/seed/e4/400/400', angle: '좌측' },
      { url: 'https://picsum.photos/seed/e5/400/400', angle: '우측' },
      { url: 'https://picsum.photos/seed/e6/400/400', angle: '클로즈업' },
    ],
    recommendationKo:
      '해당 구역 살균제 처리 및 질소 시비 조절을 권장합니다. 며칠 내 재촬영으로 추이를 확인하세요.',
    recommendationEn:
      'Consider fungicide treatment and nitrogen adjustment. Re-image in a few days to track progress.',
  },
]

export const mockStats = {
  reports: { value: 128, trend: 12 },
  pending: { value: 14, trend: -3 },
  diseaseAlerts: { value: 6, trend: 8 },
  workers: { value: 24, trend: 4 },
}
