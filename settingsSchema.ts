import * as z from "zod";

export const settingsSchema = z.object({
  env: z.object({
    "BASE_DOMAIN": z.string(),
    "LOG_DIR": z.string(),
    "CHROMIUM_PATH": z.string(),
  }),
  test: z.object({
    "HTTP_PROTOCOLS": z.string().array(),
    "TIMEOUT": z.number(),
    "DELAY": z.number(),
    "REQUEST_TIMES": z.number().int(),
    "MAX_CONCURRENT": z.number().int()
  })
})
