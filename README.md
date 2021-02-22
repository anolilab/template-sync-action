<h1 align="center">Narrowspark Template Sync Action</h1>
<p align="center">
    <a href="https://codecov.io/gh/narrowspark/template-sync"><img src="https://img.shields.io/codecov/c/github/narrowspark/template-sync-action/master.svg?style=flat-square"></a>
    <a href="https://github.com/narrowspark/template-sync-action/actions"><img src="https://img.shields.io/github/workflow/status/narrowspark/template-sync-action/build-test/master?style=flat-square"></a>
    <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square"></a>
    <a href="http://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square"></a>
</p>

This [github action](https://github.com/features/actions) gives you the possibility to sync your repository with a [github template repository](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-template-repository).


## Example Workflow
```yml
name: 'Template Sync'

on:
  schedule:
    - cron: '0 8 * * *'

jobs:
  sync:

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: narrowspark/template-sync-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          git_author_name: prisis
          git_author_email: d.bannert@anolilab.de
          template_repository: narrowspark/php-library-template
          ref: refs/heads/master
```

## Usage

<!-- start usage -->
```yaml
- uses: actions/template-sync@v1
  with:
    # Personal access token (PAT) used to fetch the repository. The PAT is configured
    # with the local git config, which enables your scripts to run authenticated git
    # commands. The post-job step removes the PAT. We recommend using a service
    # account with the least permissions necessary. Also when generating a new PAT,
    # select the least scopes necessary. [Learn more about creating and using
    # encrypted secrets](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets)
    # Default: ${{ github.token }}
    github_token: ''

    # SSH key used to fetch the repository. The SSH key is configured with the local
    # git config, which enables your scripts to run authenticated git commands. The
    # post-job step removes the SSH key. We recommend using a service account with the
    # least permissions necessary. [Learn more about creating and using encrypted
    # secrets](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets)
    ssh-key: ''

    # Known hosts in addition to the user and global host key database. The public SSH
    # keys for a host may be obtained using the utility `ssh-keyscan`. For example,
    # `ssh-keyscan github.com`. The public key for github.com is always implicitly
    # added.
    ssh-known-hosts: ''

    # Whether to perform strict host key checking. When true, adds the options
    # `StrictHostKeyChecking=yes` and `CheckHostIP=no` to the SSH command line. Use
    # the input `ssh-known-hosts` to configure additional hosts.
    # Default: true
    ssh-strict: ''

    # Whether to configure the token or SSH key with the local git config
    # Default: true
    persist-credentials: ''

    # Includes your name to the commit
    git_author_name: ''

    # Includes your email to the commit
    git_author_email: ''

    # Owner of the current repository
    owner: ''

    # The current repository name
    repo: ''

    # The title of the pull request
    pr_title: ''

    # The message in the pull request
    pr_message: ''

    # The branch, tag or SHA to checkout. When checking out the repository that
    # triggered a workflow, this defaults to the reference or SHA for that event.
    # Otherwise, defaults to `master`.
    ref: ''

    template_repository: ''

    # The branch, tag or SHA to checkout. When checking out the repository that
    # triggered a workflow, this defaults to the reference or SHA for that event.
    # Otherwise, defaults to `master`.
    template_ref: ''

    # Extend the default list with excluded files that shouldn't be synced.
    ignore_list: ''
```
<!-- end usage -->

# Diff Filters

> Note: The diff algorithm is ported from [diff-match-patch](https://github.com/google/diff-match-patch) package created by Neil Fraser.
