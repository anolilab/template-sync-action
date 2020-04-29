import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as core from '@actions/core'
import fixtures from '@octokit/fixtures'
import {Context} from '../src/context'

const context = new Context()

fixtures.mock('api.github.com/get-repository')

// Inputs for mock @actions/core
let inputs = {} as any

const run = path.join(__dirname, '..', 'lib', 'main.js')

describe('Update template fork', () => {
  beforeAll(() => {
    // Mock getInput
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return inputs[name]
    })

    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(jest.fn())
    jest.spyOn(core, 'warning').mockImplementation(jest.fn())
    jest.spyOn(core, 'info').mockImplementation(jest.fn())
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())

    // Mock context
    jest.spyOn(context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'some-owner',
        repo: 'some-repo'
      }
    })
  })

  beforeEach(() => {
    // Reset inputs
    inputs = {}
  })

  afterAll(() => {
    // Restore
    jest.restoreAllMocks()
  })

  it('should throw a setFailed on empty template var', () => {
    inputs.owner = 'owner'
    inputs.repo = 'repo'
    inputs['github_token'] = 'token'

    const options: cp.ExecSyncOptions = {
      env: process.env
    }

    cp.execSync(`node ${run}`, options)
  })
})
