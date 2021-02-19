import * as core from '@actions/core'
import {inspect} from 'util'
import path from 'path'
import fs from 'fs-extra'
import FileHound from 'filehound'
import {Diff} from './diff/diff'
import {DIFF_EQUAL, Filter, ISettings} from './interfaces'
import DiffMatchPatch from './diff/diff-match-patch'
import {diffLinesToWords} from './diff/diff-lines-to-words'
import {diffCharsToLines} from './diff/diff-chars-to-lines'
import {diffLinesToChars} from './diff/diff-lines-to-chars'

const filehound = FileHound.create()
const diff = new DiffMatchPatch()

export const sync = async (settings: ISettings) => {
  const files: string[] = filehound
    .path(settings.templateRepositoryPath)
    .discard(settings.ignoreList)
    .findSync()

  core.debug(`List of found files ${inspect(files)}`)

  for (const file of files) {
    const coreFilePath = path.join(
      settings.githubWorkspacePath,
      file.replace(settings.templateRepositoryPath, '')
    )

    if (fs.pathExistsSync(coreFilePath)) {
      const coreFileContent = await fs.readFile(coreFilePath, 'utf8')

      let wordDiffs = diffLinesToChars(
        coreFileContent,
        await fs.readFile(file, 'utf8')
      )

      let diffs: null[] | Diff[] = diff.diff(
        wordDiffs.chars1,
        wordDiffs.chars2,
        false
      )

      diffCharsToLines(diffs, wordDiffs.lineArray)

      diff.diffCleanupSemantic(diffs)

      core.debug(`Diff list before filters are applied; ${inspect(diffs)}`)

      const filters: Filter[] = []

      settings.filters.forEach((filter: Filter) => {
        if (
          file.includes(
            path.resolve(
              path.join(settings.templateRepositoryPath, filter.filePath)
            )
          )
        ) {
          filters.push(filter)
        }
      })

      core.debug(`Loaded filters ${inspect(filters)} for file ${file}.`)

      filters.forEach((filter: Filter) => {
        diffs.forEach(
          (d: null | Diff, index: number, objects: null[] | Diff[]) => {
            if (d === null) {
              return
            }

            if (filter.count < filter.maxCount) {
              let shouldRemove

              if (
                Object.prototype.toString.call(filter.filter) ===
                  '[object RegExp]' &&
                d.text.trim().match(filter.filter) !== null
              ) {
                shouldRemove = true
              } else if (filter.strict) {
                shouldRemove = d.text.trim() === String(filter.filter).trim()
              } else {
                shouldRemove = d.text
                  .trim()
                  .includes(String(filter.filter).trim())
              }

              if (shouldRemove) {
                filter.count++

                const preIndex = index - 1
                let preDiff = objects[preIndex]

                if (
                  typeof preDiff !== 'undefined' &&
                  preDiff !== null &&
                  preDiff.bind
                ) {
                  preDiff.operation = DIFF_EQUAL
                  preDiff.bind = false

                  objects[preIndex] = preDiff
                }

                objects[index] = null
              }
            }
          }
        )
      })

      diffs = diffs.filter(Boolean)

      core.debug(`Diff list after filters are applied; ${inspect(diffs)}`)
console.log(diff.patchMake(diffs)[0].diffs)

      if (diffs.length !== 0) {
        const [text, results] = diff.patchApply(
          diff.patchMake(diffs),
          coreFileContent
        )

        // @ts-ignore
        if (results.includes(false)) {
          core.error(
            `Failed to apply patch on ${coreFilePath}; ${inspect([
              text,
              results
            ])}`
          )
          console.log(text, results)
        } else {
          await fs.writeFile(coreFilePath, text)
        }
      }
    } else {
      await fs.copy(file, coreFilePath, {
        overwrite: true
      })
    }
  }
}
