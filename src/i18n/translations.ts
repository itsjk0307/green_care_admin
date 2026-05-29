export const translations = {
  ko: {
    // navigation
    dashboard: '대시보드',
    workReports: '작업 보고서',
    dailyPlan: '일일 계획',
    diseaseAnalysis: '질병 분석',
    droneScan: '드론 스캔',
    issueManagement: '이슈 관리',
    photobox: '포토박스',
    workJournal: '작업 일지',
    notifications: '알림',
    courseMap: '현장 지도',
    // user menu
    logout: '로그아웃',
    settings: '설정',
    language: '언어',
    // breadcrumbs
    home: '홈',
    overview: '개요',
    operations: '운영',
    analysis: '분석',
    diseaseDetection: '질병 탐지',
    media: '미디어',
    records: '기록',
    issues: '이슈',
    // stat cards
    totalReports: '작업 보고서',
    pendingApproval: '승인 대기',
    diseaseAlert: '질병 알림',
    activeWorkers: '현장 작업자',
    vsLastMonth: '전월 대비',
    // dashboard sections
    recentWorkReports: '최근 작업 보고서',
    recentSubmitted: '최근 제출된 작업 기록',
    viewAll: '전체보기',
    diseaseAnalysisStatus: '질병 분석 현황',
    latestAIResult: '최근 AI 분석 결과',
    confidence: '신뢰도',
    turfHealthy: '잔디 상태 양호',
    diseaseDetected: '질병 감지',
    // status
    pending: '대기중',
    approved: '승인됨',
    rejected: '반려됨',
    // misc
    menu: '메뉴',
    adminLabel: 'Admin',
    collapseMenu: '접기',
    expandMenu: '펼치기',
  },
  en: {
    // navigation
    dashboard: 'Dashboard',
    workReports: 'Work Reports',
    dailyPlan: 'Daily Plan',
    diseaseAnalysis: 'Disease Analysis',
    droneScan: 'Drone Scan',
    issueManagement: 'Issue Management',
    photobox: 'PhotoBox',
    workJournal: 'Work Journal',
    notifications: 'Notifications',
    courseMap: 'Course Map',
    // user menu
    logout: 'Logout',
    settings: 'Settings',
    language: 'Language',
    // breadcrumbs
    home: 'Home',
    overview: 'Overview',
    operations: 'Operations',
    analysis: 'Analysis',
    diseaseDetection: 'Disease Detection',
    media: 'Media',
    records: 'Records',
    issues: 'Issues',
    // stat cards
    totalReports: 'Work Reports',
    pendingApproval: 'Pending Approval',
    diseaseAlert: 'Disease Alert',
    activeWorkers: 'Active Workers',
    vsLastMonth: 'vs last month',
    // dashboard sections
    recentWorkReports: 'Recent Work Reports',
    recentSubmitted: 'Recently submitted records',
    viewAll: 'View All',
    diseaseAnalysisStatus: 'Disease Analysis',
    latestAIResult: 'Latest AI analysis results',
    confidence: 'Confidence',
    turfHealthy: 'Turf Healthy',
    diseaseDetected: 'Disease Detected',
    // status
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    // misc
    menu: 'Menu',
    adminLabel: 'Admin',
    collapseMenu: 'Collapse',
    expandMenu: 'Expand',
  },
} as const

export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations['ko']
