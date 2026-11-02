import { ref } from 'vue'
import { api } from '../api'

const config = ref(null)
let pending = null

export const useConfig = () => config

export function loadConfig(force = false) {
  if (!pending || force) {
    pending = api
      .config()
      .then((c) => (config.value = c))
      .catch((e) => {
        pending = null
        throw e
      })
  }
  return pending
}
