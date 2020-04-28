import * as core from '@actions/core'
import {Octokit} from '@octokit/core'

export async function has(
  octokit: Octokit,
  owner: string,
  repo: string,
  syncBranch: string
): Promise<null | boolean> {
  try {
    await octokit.repos.getBranch({
      owner,
      repo,
      branch: syncBranch
    })

    return true
  } catch (error) {
    if (error.name === 'HttpError' && error.status === 404) {
      return false
    }

    core.setFailed(
      `Failed to check if branch ${syncBranch} exist; ${error.message}`
    )

    process.exit(1) // there is currently no neutral exit code
  }

  return null
}
