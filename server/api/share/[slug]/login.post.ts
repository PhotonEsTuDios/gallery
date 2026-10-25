import { checkSharePassword, loadShare, setShareCookie } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  if (!cfg) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const body = await readBody<{ password?: string }>(event)
  if (!checkSharePassword(cfg, body?.password?.trim())) {
    await new Promise((r) => setTimeout(r, 600))
    throw createError({ statusCode: 401, statusMessage: 'Wrong password' })
  }
  setShareCookie(event, slug)
  return { ok: true }
})
