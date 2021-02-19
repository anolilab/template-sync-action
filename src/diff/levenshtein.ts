/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author fraser@google.com (Neil Fraser)
 */

import {Diff} from './diff'
import {DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT} from '../interfaces'

/**
 * Compute the Levenshtein distance; the number of inserted, deleted or
 * substituted characters.
 *
 * @internal
 *
 * @param {!Array.<!Diff>} diffs Array of diff tuples.
 *
 * @return {number} Number of changes.
 */
export const levenshtein = (diffs: Diff[]): number => {
  let levenshtein = 0
  let insertions = 0
  let deletions = 0

  for (let x = 0; x < diffs.length; x++) {
    const op = diffs[x].operation
    const data = diffs[x].text

    switch (op) {
      case DIFF_INSERT:
        insertions += data.length
        break
      case DIFF_DELETE:
        deletions += data.length
        break
      case DIFF_EQUAL:
        // A deletion and an insertion is one substitution.
        levenshtein += Math.max(insertions, deletions)
        insertions = 0
        deletions = 0
        break
    }
  }

  levenshtein += Math.max(insertions, deletions)

  return levenshtein
}
