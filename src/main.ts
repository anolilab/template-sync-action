import * as core from '@actions/core'
import {inspect} from 'util'
import {Octokit} from '@octokit/action'
import {retry} from '@octokit/plugin-retry'
import {createBranch, getBranch, hasBranch} from './Branch'
import {createPull} from './Pulls'
import {getRepo} from './Repos'
import {Context} from './context'

const githubToken = core.getInput('github_token', {required: true})

// plugins for octokit
const MyOctokit = Octokit.plugin(retry)

const octokit = new MyOctokit({
  auth: githubToken,
  previews: ['baptiste']
})

const context = new Context()

const defaultMessage =
  'This pull request has been created by the [template sync action](https://github.com/narrowspark/template-sync-action) action.\n\nThis PR synchronizes with {1}\n\n---\n\n You can set a custom pull request title, body, branch and commit messages, see [Usage](https://github.com/narrowspark/template-sync-action#Usage).'
let syncBranchName = 'feature/template/sync/{0}'

async function run() {
  const owner = core.getInput('owner', {required: false}) || context.repo.owner
  const repo = core.getInput('repo', {required: false}) || context.repo.repo
  // The name of the branch you want the changes pulled into. This should be an existing branch on the current repository.
  // You cannot submit a pull request to one repository that requests a merge to a base of another repository.
  const branch = core.getInput('branch', {required: true})
  let template = core.getInput('template', {required: false})

  if (!template) {
    core.debug(
      `Inputs for get repo request: ${inspect({
        owner: owner,
        repo: repo
      })}`
    )

    const repoData = await getRepo(octokit, owner, repo)

    core.debug(`Output for get repo response: ${inspect(repoData)}`)

    if (repoData.is_template) {
      template = repoData.template_repository.full_name
    } else {
      core.setFailed(
        'Template repository not found, please provide "template" key, that you want to check'
      )

      process.exit(1) // there is currently no neutral exit code
    }
  }

  syncBranchName = syncBranchName.replace('{0}', template)

  const prTitle =
    core.getInput('pr_title', {required: false}) ||
    'Enhancement: Synchronize with ' + template
  let prMessage =
    core.getInput('pr_message', {required: false}) || defaultMessage
  prMessage = prMessage.replace('{0}', template)

  core.debug(
    `Inputs for has branch request: ${inspect({
      owner: owner,
      repo: repo,
      branch: syncBranchName
    })}`
  )

  if (!(await hasBranch(octokit, owner, repo, syncBranchName))) {
    core.debug(
      `Inputs for get branch request: ${inspect({
        owner: owner,
        repo: repo,
        branch: branch
      })}`
    )

    const baseBranch = await getBranch(octokit, owner, repo, branch)

    core.debug(`Output for get branch response: ${inspect(baseBranch)}`)

    core.debug(
      `Inputs for create branch request: ${inspect({
        owner: owner,
        repo: repo,
        sha: baseBranch.object.sha,
        branch: syncBranchName
      })}`
    )

    await createBranch(
      octokit,
      owner,
      repo,
      baseBranch.object.sha,
      syncBranchName
    )
  }

  core.debug(
    `Inputs for create pull request: ${inspect({
      owner: owner,
      repo: repo,
      title: prTitle,
      head: template,
      base: syncBranchName,
      body: prMessage
    })}`
  )

  await createPull(
    octokit,
    owner,
    repo,
    prTitle,
    template,
    syncBranchName,
    prMessage
  )
}

run()
