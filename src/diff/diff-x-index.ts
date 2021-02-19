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
import {DIFF_DELETE, DIFF_INSERT} from '../interfaces'

/**
 * loc is a location in text1, compute and return the equivalent location in
 * text2.
 * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
 *
 * @param {!Array.<!Diff>} diffs Array of diff tuples.
 * @param {number} loc Location within text1.
 *
 * @return {number} Location within text2.
 */
export const diffXIndex = (diffs: Diff[], loc: number): number => {
  let chars1 = 0
  let chars2 = 0
  let lastChars1 = 0
  let lastChars2 = 0
  let x

  for (x = 0; x < diffs.length; x++) {
    if (diffs[x].operation !== DIFF_INSERT) {
      // Equality or deletion.
      chars1 += diffs[x].text.length
    }

    if (diffs[x].operation !== DIFF_DELETE) {
      // Equality or insertion.
      chars2 += diffs[x].text.length
    }

    if (chars1 > loc) {
      // Overshot the location.
      break
    }

    lastChars1 = chars1
    lastChars2 = chars2
  }

  // Was the location was deleted?
  if (diffs.length != x && diffs[x].operation === DIFF_DELETE) {
    return lastChars2
  }

  // Add the remaining character length.
  return lastChars2 + (loc - lastChars1)
}
