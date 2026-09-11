// The Twitter card is the same image as the Open Graph card. Keeping this
// file means Next still emits twitter:image tags, so X and Slack previews
// keep working without a second design to maintain.
export { default, alt, size, contentType } from './opengraph-image'
