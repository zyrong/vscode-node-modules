import { get, isObject } from 'lodash'
import { ConfigurationChangeEvent, workspace } from 'vscode'

import { EXTENSION_NAME } from './constant'
import { logger } from './extension'
import { forOwnDeep } from './utils'

const configs = {
  general: {
    debug: false,
  },
  hovers: {
    pkgName: {
      bundleSize: false,
    },
  },
  resolve: {
    preserveSymlinks: false,
  },
}

function setDebug() {
  const debug = workspace.getConfiguration('node_modules.general').debug
  if (debug) {
    logger.addLevel('debug')
  } else {
    logger.removeLevel('debug')
  }
}

function getFullConfigKey(value: string) {
  return EXTENSION_NAME + '.' + value
}
function watchConfigChange(
  e: ConfigurationChangeEvent,
  configKey: string,
  onChange?: (configValue: any) => void
) {
  const wsConfiguration = workspace.getConfiguration(EXTENSION_NAME)
  if (e.affectsConfiguration(getFullConfigKey(configKey))) {
    const configValue = wsConfiguration.get(configKey) as any
    if (onChange) {
      onChange(configValue)
      return
    }
    const lastDotIndex = configKey.lastIndexOf('.')
    if (lastDotIndex !== -1) {
      const valueKey = configKey.slice(lastDotIndex + 1)
      const parentKey = configKey.slice(0, lastDotIndex)
      get(configs, parentKey)[valueKey] = configValue
    } else {
      configs[configKey as keyof typeof configs] = configValue
    }
  }
}

function loadWorkSpaceConfigs() {
  const wsConfiguration = workspace.getConfiguration(EXTENSION_NAME)
  forOwnDeep(configs, (value, key, parentObject, parentKeyPath) => {
    if (!isObject(value)) {
      parentObject[key] = wsConfiguration.get<any>(
        parentKeyPath && parentKeyPath + '.' + key
      )
    }
  })
}

function initExtensionConfigs() {
  loadWorkSpaceConfigs()
  workspace.onDidChangeConfiguration((e) => {
    watchConfigChange(e, 'general.debug', (debug: boolean) => {
      if (debug) {
        logger.addLevel('debug')
      } else {
        logger.removeLevel('debug')
      }
    })
    watchConfigChange(e, 'hovers.pkgName.bundleSize')
    watchConfigChange(e, 'resolve.preserveSymlinks')
  })

  setDebug()
}

export { configs, initExtensionConfigs }
