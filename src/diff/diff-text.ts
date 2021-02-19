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

/**
 * Compute and return the source text (all equalities and deletions).
 *
 * @param {!Array.<!Diff>} diffs Array of diff tuples.
 *
 * @return {string} Source text.
 */
export const diffText = (diffs: Diff[], type: number): string => {
  const text: string[] = []

  for (let x = 0; x < diffs.length; x++) {
    if (diffs[x].operation !== type) {
      text[x] = diffs[x].text
    }
  }

  return text.join('')
}
