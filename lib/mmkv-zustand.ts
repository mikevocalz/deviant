import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { storage } from './storage'

const mmkvStateStorage: StateStorage = {
  setItem: (name, value) => {
    storage.set(name, value)
  },
  getItem: (name) => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: (name) => {
    storage.remove(name)
  }
}

export const mmkvStorage = createJSONStorage(() => mmkvStateStorage)
