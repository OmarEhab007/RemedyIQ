import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server'

import { isHeaderAuthMode } from '@/lib/auth-mode'

// Do not import @clerk/nextjs/server at module scope: clerkMiddleware validates
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY on load and crashes when it is unset (Docker / CI).
let clerkComposite: NextMiddleware | undefined

async function runClerk(req: NextRequest, event: NextFetchEvent) {
  if (!clerkComposite) {
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')
    const isProtectedRoute = createRouteMatcher([
      '/',
      '/upload(.*)',
      '/analysis(.*)',
      '/explorer(.*)',
      '/ai(.*)',
      '/trace(.*)',
    ])
    clerkComposite = clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        await auth.protect()
      }
    })
  }
  return clerkComposite(req, event)
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isHeaderAuthMode()) {
    return NextResponse.next()
  }
  return runClerk(req, event)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
