/**
 * An image is ready only when the source reported by its load event still
 * belongs to the image currently rendered by the card.
 *
 * @param {string | null | undefined} imageSource
 * @param {string | null | undefined} loadedImageSource
 */
export function isAnimeImageLoaded(imageSource, loadedImageSource) {
  return Boolean(imageSource && imageSource === loadedImageSource);
}
