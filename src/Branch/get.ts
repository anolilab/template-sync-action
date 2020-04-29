import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {inspect} from 'util'

interface Data {
  data: {
    ref: string
    node_id: string
    url: string
    object: {
      type: string
      sha: string
      url: string
    }
  }
}

export async function get(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
  // @ts-ignore
): Promise<Data> {
  try {
    return await octokit.git.getRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`
    })
  } catch (error) {
    core.setFailed(`Failed to get branch ${branch}; ${inspect(error)}`)

    process.exit(1) // there is currently no neutral exit code
  }
}
