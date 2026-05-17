import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://wnifvpadsttgyxjellmx.supabase.co'
const supabaseKey = 'sb_publishable_0TAlUKDZZkCMjYj4FxAV2w_cG3OjZEC'

export const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'

/** e.g. getTable('forgot') → forgot_dev locally, forgot on GitHub Pages */
export function getTable(baseName) {
  return isLocal ? `${baseName}_dev` : baseName
}

export const supabase = createClient(supabaseUrl, supabaseKey)
