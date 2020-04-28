import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {inspect} from 'util'

export async function has(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  try {
    await octokit.repos.getBranch({
      owner,
      repo,
      branch
    })

    return true
  } catch (error) {
    if (error.name === 'HttpError' && error.status === 404) {
      return false
    }

    core.setFailed(
      `Failed to check if branch ${branch} exist; ${inspect(error)}`
    )

    process.exit(1) // there is currently no neutral exit code
  }
}
