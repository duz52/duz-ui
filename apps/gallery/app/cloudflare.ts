/**
 * The Worker's bindings, handed to route loaders.
 *
 * The Worker entry sets this once per request and anything needing a binding
 * reads it from the loader's `context`. Without it a loader can only reach
 * the deployment over HTTP — which on Workers means asking the edge for a
 * hostname this Worker itself serves.
 */

import { createContext } from "react-router"

export const cloudflare = createContext<{ env: Env; ctx: ExecutionContext }>()
