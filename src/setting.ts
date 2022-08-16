import { workspace } from 'vscode'

import { logger } from './extension'

function setDebug() {
  const debug = workspace.getConfiguration('node_modules.general').debug
  if (debug) {
    logger.addLevel('debug')
  } else {
    logger.removeLevel('debug')
  }
}

export { setDebug }
