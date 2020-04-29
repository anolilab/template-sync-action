import * as core from '@actions/core'
import {inspect} from 'util'
import {Octokit} from '@octokit/core'

export async function create(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string
): Promise<void> {
  const errorMessage = `No commits between ${owner}:${head} and ${base}`

  try {
    await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body
    })
  } catch (error) {
    if (!!error.errors && error.errors[0].message === errorMessage) {
      core.info(errorMessage)

      process.exit(0) // there is currently no neutral exit code
    } else {
      core.setFailed(`Failed to create a pull request; ${inspect(error)}`)

      process.exit(1) // there is currently no neutral exit code
    }
  }
}
