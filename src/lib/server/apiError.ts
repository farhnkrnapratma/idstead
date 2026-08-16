import {json} from '@sveltejs/kit'

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: string
) {
  return json({code, message, ...(details ? {details} : {})}, {status})
}
