import { createHttpHandler } from '../server/src/http-handler.js'

// No listening socket or development process is started inside Vercel.
export default createHttpHandler()
