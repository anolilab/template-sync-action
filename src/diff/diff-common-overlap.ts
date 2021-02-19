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

/**
 * Determine if the suffix of one string is the prefix of another.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 *
 * @return {number} The number of characters common to the end of the first
 *     string and the start of the second string.
 */
export const diffCommonOverlap = (text1: string, text2: string): number => {
  // Cache the text lengths to prevent multiple calls.
  const text1Length = text1.length
  const text2Length = text2.length

  // Eliminate the null case.
  if (text1Length == 0 || text2Length == 0) {
    return 0
  }
  // Truncate the longer string.
  if (text1Length > text2Length) {
    text1 = text1.substring(text1Length - text2Length)
  } else if (text1Length < text2Length) {
    text2 = text2.substring(0, text1Length)
  }

  const textLength = Math.min(text1Length, text2Length)

  // Quick check for the worst case.
  if (text1 == text2) {
    return textLength
  }

  // Start by looking for a single character match
  // and increase length until no match is found.
  // Performance analysis: https://neil.fraser.name/news/2010/11/04/
  let best = 0
  let length = 1

  while (true) {
    const pattern = text1.substring(textLength - length)
    const found = text2.indexOf(pattern)

    if (found == -1) {
      return best
    }

    length += found

    if (
      found == 0 ||
      text1.substring(textLength - length) == text2.substring(0, length)
    ) {
      best = length
      length++
    }
  }
}
