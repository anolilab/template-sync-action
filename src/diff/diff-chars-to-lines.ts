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
 * Rehydrate the text in a diff from a string of line hashes to real lines of
 * text.
 *
 * @param {!Array.<!Diff>} diffs Array of diff tuples.
 * @param {!Array.<string>} lineArray Array of unique strings.
 */
export const diffCharsToLines = (diffs: Diff[], lineArray: string[]) => {
  for (let i = 0; i < diffs.length; i++) {
    const chars = diffs[i].text
    const text: string[] = []

    for (let j = 0; j < chars.length; j++) {
      text[j] = lineArray[chars.charCodeAt(j)]
    }

    diffs[i].text = text.join('')
  }
}
