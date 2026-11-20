import { createContext } from 'react'

// Keep context identity independent of hot-reloaded provider and planner modules.
export const AppContext = createContext(null)
