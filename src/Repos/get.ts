import * as core from '@actions/core'
import {inspect} from 'util'
import {Octokit} from '@octokit/core'

interface Data {
  data: {
    template_repository?: {
      full_name: string
    }
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
    core.setFailed(`Failed to get repository; ${inspect(error)}`)

    process.exit(1) // there is currently no neutral exit code
  }
}
