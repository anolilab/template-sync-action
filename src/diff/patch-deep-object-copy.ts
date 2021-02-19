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
import {PatchObject} from './patch-object'
import {Diff} from './diff'

/**
 * Given an array of patches, return another array that is identical.
 *
 * @param {!Array.<!PatchObject>} patches Array of Patch objects.
 *
 * @return {!Array.<!PatchObject>} Array of Patch objects.
 */
export const patchDeepObjectCopy = (patches: PatchObject[]): PatchObject[] => {
  // Making deep copies is hard in JavaScript.
  const patchesCopy: PatchObject[] = []

  for (let x = 0; x < patches.length; x++) {
    const patch = patches[x]
    const patchCopy = new PatchObject()

    patchCopy.diffs = []

    for (let y = 0; y < patch.diffs.length; y++) {
      patchCopy.diffs[y] = new Diff(
        patch.diffs[y].operation,
        patch.diffs[y].text
      )
    }

    patchCopy.start1 = patch.start1
    patchCopy.start2 = patch.start2
    patchCopy.length1 = patch.length1
    patchCopy.length2 = patch.length2

    patchesCopy[x] = patchCopy
  }

  return patchesCopy
}
