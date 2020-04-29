import {readFileSync, existsSync} from 'fs'
import {WebhookPayload} from './interfaces'
import {EOL} from 'os'

export class Context {
  payload: WebhookPayload

  constructor() {
    this.payload = {}

    if (process.env.GITHUB_EVENT_PATH) {
      if (existsSync(process.env.GITHUB_EVENT_PATH)) {
        this.payload = JSON.parse(
          readFileSync(process.env.GITHUB_EVENT_PATH, {encoding: 'utf8'})
        )
      } else {
        const path = process.env.GITHUB_EVENT_PATH

        process.stdout.write(`GITHUB_EVENT_PATH ${path} does not exist${EOL}`)
      }
    }
  }

  get repo(): {owner: string; repo: string} {
    if (process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
      return {owner, repo}
    }

    if (this.payload.repository) {
      return {
        owner: this.payload.repository.owner.login,
        repo: this.payload.repository.name
      }
    }

    throw new Error(
      "context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'"
    )
  }
}
