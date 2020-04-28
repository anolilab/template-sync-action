import * as coreCommand from '@actions/core/lib/command'

/**
 * Indicates whether the POST action is running.
 */
export const IsPost = !!process.env['STATE_isPost']

/**
 * The template repository path for the POST action. The value is empty during the MAIN action.
 */
export const TemplateRepositoryPath =
  (process.env['STATE_template_repository_path'] as string) || ''

/**
 * The repository path for the POST action. The value is empty during the MAIN action.
 */
export const RepositoryPath =
  (process.env['STATE_repositoryPath'] as string) || ''

/**
 * The SSH key path for the POST action. The value is empty during the MAIN action.
 */
export const SshKeyPath =
  (process.env['STATE_template_ssh_key_path'] as string) || ''

/**
 * The SSH known hosts path for the POST action. The value is empty during the MAIN action.
 */
export const SshKnownHostsPath =
  (process.env['STATE_template_ssh_known_hosts_path'] as string) || ''

/**
 * Save the repository path so the POST action can retrieve the value.
 *
 * @param {string} repositoryPath - Path to repository.
 */
export function setTemplateRepositoryPath(repositoryPath: string): void {
  coreCommand.issueCommand(
    'save-state',
    {name: 'template_repository_path'},
    repositoryPath
  )
}

/**
 * Save the SSH key path so the POST action can retrieve the value.
 *
 * @param {string} sshKeyPath - The ssh key path.
 */
export function setSshKeyPath(sshKeyPath: string): void {
  coreCommand.issueCommand(
    'save-state',
    {name: 'template_ssh_key_path'},
    sshKeyPath
  )
}

/**
 * Save the SSH known hosts path so the POST action can retrieve the value.
 *
 * @param {string} sshKnownHostsPath - The ssh known hosts path.
 */
export function setSshKnownHostsPath(sshKnownHostsPath: string): void {
  coreCommand.issueCommand(
    'save-state',
    {name: 'template_ssh_known_hosts_path'},
    sshKnownHostsPath
  )
}

// Publish a variable so that when the POST action runs, it can determine it should run the cleanup logic.
// This is necessary since we don't have a separate entry point.
if (!IsPost) {
  coreCommand.issueCommand('save-state', {name: 'isPost'}, 'true')
}
