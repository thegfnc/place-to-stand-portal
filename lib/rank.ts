const RANK_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const MIN_CHAR_INDEX = 0
const MAX_CHAR_INDEX = RANK_ALPHABET.length - 1

const rankCharPattern = /^[0-9a-z]+$/

const toLower = (value: string) => value.trim().toLowerCase()

const getCharIndex = (char: string) => RANK_ALPHABET.indexOf(char)

const toRankString = (indices: number[]) =>
  indices
    .map(index => RANK_ALPHABET[index] ?? RANK_ALPHABET[MIN_CHAR_INDEX])
    .join('')

const assertValidRank = (rank: string | null | undefined) => {
  if (!rank) {
    return
  }

  if (!rankCharPattern.test(rank)) {
    throw new Error('Rank contains invalid characters.')
  }
}

const computeBetween = (prev: string | null, next: string | null) => {
  const left = prev?.length ? toLower(prev) : ''
  const right = next?.length ? toLower(next) : ''

  assertValidRank(left)
  assertValidRank(right)

  let position = 0
  const result: number[] = []

  while (true) {
    const leftIndex =
      position < left.length ? getCharIndex(left[position]) : MIN_CHAR_INDEX
    const rightIndex =
      position < right.length ? getCharIndex(right[position]) : MAX_CHAR_INDEX

    if (leftIndex < 0 || rightIndex < 0) {
      throw new Error(
        'Rank contains characters outside the supported alphabet.'
      )
    }

    if (rightIndex - leftIndex > 1) {
      const nextIndex = Math.floor((leftIndex + rightIndex) / 2)
      result.push(nextIndex)
      return toRankString(result)
    }

    result.push(leftIndex)
    position += 1
  }
}

export const getRankBetween = (prev: string | null, next: string | null) => {
  if (prev && next && prev >= next) {
    throw new Error('Previous rank must be less than the next rank.')
  }

  return computeBetween(prev, next)
}

export const getRankAfter = (prev: string | null) => getRankBetween(prev, null)

export const getRankBefore = (next: string | null) => getRankBetween(null, next)

export const isValidRank = (value: string) =>
  rankCharPattern.test(toLower(value))

export const normalizeRank = (value: string) => {
  const normalized = toLower(value)
  if (!isValidRank(normalized)) {
    throw new Error(
      'Rank must only contain digits 0-9 or lowercase letters a-z.'
    )
  }
  return normalized
}
