import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {inspect} from 'util'

export async function _delete(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  syncBranch: string
): Promise<void> {
  try {
    core.debug(`Creating branch ${syncBranch}`)

    await octokit.git.createRef({
      ref: `refs/heads/${syncBranch}`,
      sha,
      owner,
      repo
    })
  } catch (error) {
    core.setFailed(`Failed to delete branch ${syncBranch}; ${inspect(error)}`)

    process.exit(1) // there is currently no neutral exit code
  }
}
