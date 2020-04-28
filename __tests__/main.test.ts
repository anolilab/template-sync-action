import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as core from '@actions/core'

jest.mock('core');

const run = path.join(__dirname, '..', 'lib', 'main.js')

describe('Update template fork', () => {
  it('should throw a setFailed on empty template var', () => {
    core.getInput
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)

      const options: cp.ExecSyncOptions = {
        env: process.env
      }

      cp.execSync(`node ${run}`, options)
  })
})
