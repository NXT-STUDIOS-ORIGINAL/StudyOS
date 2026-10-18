export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isStr = (v: unknown): v is string => typeof v === 'string'

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum)
