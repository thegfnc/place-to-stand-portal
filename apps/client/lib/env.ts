import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

let _env: z.infer<typeof schema> | undefined

function getEnv() {
  if (!_env) {
    _env = schema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
  }
  return _env
}

// For backwards compatibility
export const env = new Proxy({} as z.infer<typeof schema>, {
  get(_target, prop) {
    return getEnv()[prop as keyof z.infer<typeof schema>]
  },
})
