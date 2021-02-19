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
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
export class Diff {
  0: number
  1: string
  2: boolean

  /**
   * Class representing one diff tuple.
   * Attempts to look like a two-element array (which is what this used to be).
   *
   * @param {number} op Operation, one of: DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL.
   * @param {string} text Text to be deleted, inserted, or retained.
   * @param {boolean} bind
   */
  constructor(op: number, text: string, bind = false) {
    this[0] = op
    this[1] = text
    this[2] = bind
  }

  /**
   * Create a Diff object from a two-element array.
   *
   * @return {Diff} new Diff object.
   */
  static fromArray(diffArray: [number, string, boolean]): Diff {
    return new Diff(diffArray[0], diffArray[1], diffArray[2] || false)
  }

  get operation(): number {
    return this[0]
  }

  set operation(op: number) {
    this[0] = op
  }

  get text(): string {
    return this[1]
  }

  set text(text: string) {
    this[1] = text
  }

  get bind(): boolean {
    return this[2]
  }

  set bind(id: boolean) {
    this[2] = id
  }

  /**
   * Emulate the output of a two-element array.
   * @return {string} Diff operation as a string.
   */
  toString() {
    return `${this.operation},${this.text}`
  }
}
