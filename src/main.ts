import * as core from '@actions/core'
import {inspect} from 'util'
import {Octokit} from '@octokit/action'
import {retry} from '@octokit/plugin-retry'
import {createBranch, getBranch, hasBranch} from './Branch'
import {getRepo} from './Repos'

const MyOctokit = Octokit.plugin(retry)

const githubToken = core.getInput('github_token', {required: true})
const octokit = new MyOctokit({
  auth: githubToken,
  previews: ['baptiste']
})

// @ts-ignore
const [repoOwner, repoRepo] = process.env.GITHUB_REPOSITORY.split('/')

const defaultMessage =
  'This pull request has been created by the [template sync action](https://github.com/narrowspark/template-sync-action) action.\n\nThis PR synchronizes with {1}\n\n---\n\n You can set a custom pull request title, body, branch and commit messages, see [Usage](https://github.com/narrowspark/template-sync-action#Usage).'
let syncBranchName = 'feature/template/sync/{0}'

async function run() {
  const owner = core.getInput('owner', {required: false}) || repoOwner
  const repo = core.getInput('repo', {required: false}) || repoRepo
  // The name of the branch you want the changes pulled into. This should be an existing branch on the current repository.
  // You cannot submit a pull request to one repository that requests a merge to a base of another repository.
  const branch = core.getInput('branch', {required: true})
  let template = core.getInput('template', {required: false})

  if (!template) {
    const repoData = await getRepo(octokit, owner, repo)

    if (repoData.is_template) {
      template = repoData.template_repository.full_name
    } else {
      core.setFailed(
        'Template repository not found, please provide "template" key, that you want to check'
      )
    }
  }

  syncBranchName = syncBranchName.replace('{0}', template)

  const prTitle =
    core.getInput('pr_title', {required: false}) ||
    'Enhancement: Synchronize with ' + template
  const prMessage =
    core.getInput('pr_message', {required: false}) || defaultMessage

  if (!(await hasBranch(octokit, owner, repo, syncBranchName))) {
    const baseBranch = await getBranch(octokit, owner, repo, branch)

    await createBranch(
      octokit,
      owner,
      repo,
      baseBranch.object.sha,
      syncBranchName
    )
  }

  const inputs = {
    owner: owner,
    repo: repo,
    title: prTitle,
    head: template,
    base: syncBranchName,
    body: prMessage.replace('{0}', template),
    maintainer_can_modify: false
  }

  core.debug(`Inputs for create pull request: ${inspect(inputs)}`)

  try {
    await octokit.pulls.create(inputs)
  } catch (error) {
    if (
      !!error.errors &&
      error.errors[0].message ==
        'No commits between ' +
          owner +
          ':' +
          syncBranchName +
          ' and ' +
          template
    ) {
      core.info(
        'No commits between ' +
          owner +
          ':' +
          syncBranchName +
          ' and ' +
          template
      )

      process.exit(0) // there is currently no neutral exit code
    } else {
      core.setFailed(`Failed to create a pull request; ${inspect(error)}`)

      process.exit(1) // there is currently no neutral exit code
    }
  }
}

run()
