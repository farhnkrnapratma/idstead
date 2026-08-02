/** @format */

import type {RequestHandler} from './$types'
import {handleAuthorJsonRequest} from '$lib/authorApi'

export const GET: RequestHandler = async ({url, locals, request}) => {
  return handleAuthorJsonRequest(url, locals, request)
}
