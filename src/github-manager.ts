import {Octokit} from '@octokit/core'
import * as core from '@actions/core'
import {inspect} from 'util'
import {v4 as uuidv4} from 'uuid'
import path from 'path'
import fs from 'fs'
import * as io from '@actions/io'
import * as toolCache from '@actions/tool-cache'
import assert from 'assert'
import {
  IGithubManager,
  IGithubManagerBranch,
  IGithubManagerPulls,
  IGithubManagerRepos,
  OctokitHttpError
} from './interfaces'

const IS_WINDOWS = process.platform === 'win32'

export class GithubManager implements IGithubManager {
  octokit: Octokit

  constructor(octokit: Octokit) {
    this.octokit = octokit
  }

  get branch(): IGithubManagerBranch {
    return {
      create: async (
        owner: string,
        repo: string,
        sha: string,
        syncBranch: string
      ) => {
        try {
          core.debug(`Creating branch ${syncBranch}`)

          await this.octokit.git.createRef({
            ref: `refs/heads/${syncBranch}`,
            sha,
            owner,
            repo
          })
        } catch (error) {
          throw new Error(
            `Failed to create branch ${syncBranch}; ${inspect(error)}`
          )
        }
      },
      delete: async (owner: string, repo: string, branch: string) => {
        try {
          core.debug(`Delete branch ${branch}`)

          await this.octokit.git.deleteRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`
          })
        } catch (error) {
          throw new Error(
            `Failed to delete branch ${branch}; ${inspect(error)}`
          )
        }
      },
      get: async (owner: string, repo: string, branch: string) => {
        try {
          return await this.octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`
          })
        } catch (error) {
          throw new Error(`Failed to get branch ${branch}; ${inspect(error)}`)
        }
      },
      has: async (owner: string, repo: string, branch: string) => {
        try {
          await this.octokit.repos.getBranch({
            owner,
            repo,
            branch
          })

          return true
        } catch (error) {
          const err: OctokitHttpError = error

          if (err.name === 'HttpError' && err.status === 404) {
            return false
          }

          throw new Error(
            `Failed to check if branch ${branch} exist; ${inspect(err)}`
          )
        }
      }
    }
  }

  get pulls(): IGithubManagerPulls {
    return {
      create: async (
        owner: string,
        repo: string,
        head: string,
        base: string,
        title: string,
        body: string
      ): Promise<void> => {
        try {
          await this.octokit.pulls.create({
            owner,
            repo,
            title,
            head,
            base,
            body
          })
        } catch (error) {
          const err: OctokitHttpError = error

          core.debug(inspect(err))

          if (
            err.name === 'HttpError' &&
            (err.message.includes('No commits between') ||
              err.message.includes('A pull request already exists for'))
          ) {
            core.info(err.message)

            process.exit(0) // there is currently no neutral exit code
          } else {
            throw new Error(
              `Failed to create a pull request; ${inspect(error)}`
            )
          }
        }
      }
    }
  }

  get repos(): IGithubManagerRepos {
    const getArchiveLink = async (
      owner: string,
      repo: string,
      ref: string
    ): Promise<Buffer> => {
      const response = await this.octokit.repos.getArchiveLink({
        owner,
        repo,
        archive_format: IS_WINDOWS ? 'zipball' : 'tarball', // eslint-disable-line @typescript-eslint/camelcase
        ref
      })

      if (response.status !== 200) {
        throw new Error(
          `Unexpected response from GitHub API. Status: ${response.status}, Data: ${response.data}`
        )
      }

      return Buffer.from(response.data) // response.data is ArrayBuffer
    }

    return {
      get: async (
        owner: string,
        repo: string
        // @ts-ignore
      ): Promise<Data> => {
        try {
          return await this.octokit.repos.get({
            owner,
            repo
          })
        } catch (error) {
          throw new Error(`Failed to get repository; ${inspect(error)}`)
        }
      },
      getArchiveLink,
      downloadRepository: async (
        owner: string,
        repo: string,
        ref: string
      ): Promise<void> => {
        const repositoryPath = `${owner}_${repo}`

        // Download the archive
        core.info('Downloading the archive')
        let archiveData = await getArchiveLink(owner, repo, ref)

        // Write archive to disk
        core.info('Writing archive to disk')

        const uniqueId = uuidv4()
        const archivePath = path.join(repositoryPath, `${uniqueId}.tar.gz`)

        await fs.promises.writeFile(archivePath, archiveData)
        archiveData = Buffer.from('') // Free memory

        // Extract archive
        core.info('Extracting the archive')

        const extractPath = path.join(repositoryPath, uniqueId)

        await io.mkdirP(extractPath)

        if (IS_WINDOWS) {
          await toolCache.extractZip(archivePath, extractPath)
        } else {
          await toolCache.extractTar(archivePath, extractPath)
        }

        io.rmRF(archivePath)

        // Determine the path of the repository content. The archive contains
        // a top-level folder and the repository content is inside.
        const archiveFileNames = await fs.promises.readdir(extractPath)

        assert.ok(
          archiveFileNames.length === 1,
          'Expected exactly one directory inside archive'
        )

        const archiveVersion = archiveFileNames[0] // The top-level folder name includes the short SHA

        core.info(`Resolved version ${archiveVersion}`)

        const tempRepositoryPath = path.join(extractPath, archiveVersion)

        // Move the files
        for (const fileName of await fs.promises.readdir(tempRepositoryPath)) {
          const sourcePath = path.join(tempRepositoryPath, fileName)
          const targetPath = path.join(repositoryPath, fileName)

          if (IS_WINDOWS) {
            await io.cp(sourcePath, targetPath, {recursive: true}) // Copy on Windows (Windows Defender may have a lock)
          } else {
            await io.mv(sourcePath, targetPath)
          }
        }

        io.rmRF(extractPath)
      }
    }
  }
}
