import * as core from '@actions/core'
import {Octokit} from '@octokit/core'

interface Data {
  is_template: boolean
  template_repository: {
    full_name: string
  }
}

export async function get(
  octokit: Octokit,
  owner: string,
  repo: string
  // @ts-ignore
): Promise<Data> {
  try {
    return await octokit.repos.get({
      owner,
      repo
    })
  } catch (error) {
    core.setFailed(`Failed to get repository; ${error.message}`)
  }
}
