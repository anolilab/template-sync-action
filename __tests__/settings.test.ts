import path from "path"
import * as core from '@actions/core'
import {GithubActionContext} from '../lib/github-action-context'
import fs from 'fs-extra'
import {PathLike} from 'fs'

const originalGitHubWorkspace = process.env['GITHUB_WORKSPACE']

const context = new GithubActionContext()

const gitHubWorkspace = path.resolve('/checkout-tests/workspace')

// Inputs for mock @actions/core
let inputs = {} as any

// Shallow clone original @actions/github context
let originalContext = {...context}

describe('settings tests', () => {
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

    // Mock github context
    jest.spyOn(context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'some-owner',
        repo: 'some-repo'
      }
    })
    context.ref = 'refs/heads/some-ref'

    // Mock ./fs-helper directoryExistsSync()
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((path: PathLike) => path == gitHubWorkspace)

    // GitHub workspace
    process.env['GITHUB_WORKSPACE'] = gitHubWorkspace
  })

  beforeEach(() => {
    // Reset inputs
    inputs = {}
  })

  afterAll(() => {
    // Restore GitHub workspace
    delete process.env['GITHUB_WORKSPACE']

    if (originalGitHubWorkspace) {
      process.env['GITHUB_WORKSPACE'] = originalGitHubWorkspace
    }

    // Restore @actions/github context
    context.ref = originalContext.ref

    // Restore
    jest.restoreAllMocks()
  })
})
