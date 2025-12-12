export interface DetectionResult {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export interface ProctoringStatus {
  personCount: number;
  violations: {
    multiplePerson: number;
    noPerson: number;
    total: number;
  };
  sessionStartTime: Date;
  isActive: boolean;
}

export interface AlertMessage {
  type: 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}