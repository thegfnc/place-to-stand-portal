export {
  escapeHtml,
  formatExpiryWindow,
  renderEmail,
  renderRichEmail,
  type EmailAction,
  type EmailLayoutArgs,
  type RichEmailLayoutArgs,
  type RenderedEmail,
} from './layout'
export {
  sendEmail,
  type OutboundEmail,
  type TransportConfig,
} from './transport'
export * from './templates/index'
