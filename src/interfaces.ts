import {URL} from 'url'

export interface IPayloadRepository {
  full_name?: string
  name: string
  owner: {
    login: string
    name?: string
  }
}

export interface IWebhookPayload {
  repository?: IPayloadRepository
}

export interface IGitCommandManager {
  init(): Promise<void>
  checkGitVersion(): void
  fetch(fetchDepth: number, refSpec: string[]): Promise<void>
  checkout(ref: string, startPoint: string): Promise<void>
  sha(type: string): Promise<string>
  addAll(): Promise<boolean>
  commit(message: string): Promise<boolean>
  push(ref: string): Promise<boolean>
  status(args: string[]): Promise<string>
  log1(): Promise<void>
  config(
    configKey: string,
    configValue: string,
    globalConfig?: boolean
  ): Promise<void>
  configExists(configKey: string, globalConfig?: boolean): Promise<boolean>
  tryConfigUnset(configKey: string, globalConfig?: boolean): Promise<boolean>
  getWorkingDirectory(): string
  setEnvironmentVariable(name: string, value: string): void
  removeEnvironmentVariable(name: string): void
  tryDisableAutomaticGarbageCollection(): Promise<boolean>
  remoteAdd(remoteName: string, remoteUrl: string): Promise<void>
  branchExists(remote: boolean, pattern: string): Promise<boolean>
  tagExists(pattern: string): Promise<boolean>
}

export interface IGithubManagerBranch {
  create: (
    owner: string,
    repo: string,
    sha: string,
    syncBranch: string
  ) => Promise<void>
  delete: (owner: string, repo: string, branch: string) => Promise<void>
  get: (
    owner: string,
    repo: string,
    branch: string
  ) => Promise<{
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
  }>
  has: (owner: string, repo: string, branch: string) => Promise<boolean>
}

export interface IGithubManagerPulls {
  create: (
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string
  ) => Promise<void>
}

export interface IGithubManagerRepos {
  get: (
    owner: string,
    repo: string
    // @ts-ignore
  ) => Promise<{
    data: {
      template_repository?: {
        full_name: string
      }
    }
  }>
  getArchiveLink: (owner: string, repo: string, ref: string) => Promise<Buffer>
  downloadRepository: (
    owner: string,
    repo: string,
    ref: string
  ) => Promise<void>
}

export interface IGithubManager {
  branch: IGithubManagerBranch
  pulls: IGithubManagerPulls
  repos: IGithubManagerRepos
}

export interface ISettings {
  /**
   * The auth token to use when fetching the repository.
   */
  authToken: string

  /**
   * The github api url.
   */
  apiUrl: string

  /**
   * The github url.
   */
  serverUrl: URL

  /**
   * The SSH key to configure.
   */
  sshKey: string

  /**
   * Additional SSH known hosts.
   */
  sshKnownHosts: string

  /**
   * Indicates whether the server must be a known host.
   */
  sshStrict: boolean

  /**
   * Indicates whether to persist the credentials on disk to enable scripting authenticated git commands.
   */
  persistCredentials: boolean

  /**
   * The author name and email for the commit message.
   */
  authorName: string
  authorEmail: string

  /**
   * Owner of the current repository.
   */
  repositoryOwner: string

  /**
   * The current repository name.
   */
  repositoryName: string

  repositoryPath: string

  /**
   * GitHub workspace.
   */
  githubWorkspacePath: string

  /**
   * The pr message.
   */
  messageHead: string

  /**
   * The pr message.
   */
  messageBody: string

  /**
   * The name of the ref you want the changes pulled into. This should be an existing ref on the current repository.
   * You cannot submit a pull request to one repository that requests a merge to a base of another repository.
   */
  ref: string

  /**
   * The ref name for the merge request.
   */
  syncBranchName: string

  /**
   * The template ref name, i most cases "master".
   */
  templateRepositoryRef: string

  /**
   * The template repository path {owner}/{repo}.
   */
  templateRepository: string

  /**
   * The full url tp the template repository.
   */
  templateRepositoryUrl: string

  /**
   * Path to the template repository folder.
   */
  templateRepositoryPath: string

  /**
   * List of ignored files and directories that that should be excluded from the template sync.
   */
  ignoreList: string[]

  clean: boolean
}
