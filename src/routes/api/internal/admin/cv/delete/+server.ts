import type {RequestHandler} from './$types'
import {processCvDelete} from '$lib/server/adminCv'

export const POST: RequestHandler = async ({request, platform}) => {
  return processCvDelete(request, platform)
}
