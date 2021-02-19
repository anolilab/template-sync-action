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
 * Initialise the alphabet for the Bitap algorithm.
 *
 * @param {string} pattern The text to encode.
 *
 * @return {!Object} Hash of character locations.
 */
export const matchAlphabet = (pattern: string): {[key: string]: number} => {
  const s: {[key: string]: number} = {}

  for (let i = 0; i < pattern.length; i++) {
    s[pattern.charAt(i)] = 0
  }

  for (let i = 0; i < pattern.length; i++) {
    s[pattern.charAt(i)] |= 1 << (pattern.length - i - 1)
  }

  return s
}
